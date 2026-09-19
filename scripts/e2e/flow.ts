/**
 * End-to-end flow test for the v2 data layer, run against a SCRATCH Supabase
 * project that has supabase/v2/01-03 applied and these confirmed users (all
 * sharing E2E_PASSWORD): e2e-{admin-a,doctor-a,nurse-a,admin-b,outsider}@example.com
 *
 *   E2E_URL=... E2E_ANON_KEY=... E2E_PASSWORD=... \
 *   node --experimental-strip-types --import ./scripts/e2e/register.mjs scripts/e2e/flow.ts
 *
 * It exercises the app's real src/lib/supabase/ward.ts over the real API
 * (PostgREST + JWT), so it covers the request path the SQL tests cannot.
 */
import { createClient } from "@supabase/supabase-js";
import { setCurrentClient } from "./testClient.ts";
import * as api from "../../src/lib/supabase/ward.ts";

const URL = process.env.E2E_URL;
const KEY = process.env.E2E_ANON_KEY;
const PASSWORD = process.env.E2E_PASSWORD;
if (!URL || !KEY || !PASSWORD) {
  console.error("Set E2E_URL, E2E_ANON_KEY and E2E_PASSWORD.");
  process.exit(2);
}

const results: { name: string; pass: boolean; detail?: string }[] = [];
function ok(name: string, cond: unknown, detail?: string) {
  results.push({ name, pass: Boolean(cond), detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond && detail ? `  -> ${detail}` : ""}`);
}

async function rejects(name: string, p: Promise<unknown>, contains: RegExp) {
  try {
    await p;
    ok(name, false, "expected an error but the call succeeded");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ok(name, contains.test(msg), `got: ${msg}`);
  }
}

async function login(email: string) {
  const sb = createClient(URL!, KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD! });
  if (error || !data.user) throw new Error(`login ${email}: ${error?.message}`);
  setCurrentClient(sb);
  return data.user;
}

const email = (who: string) => `e2e-${who}@example.com`;

async function main() {
  // ---- Hospital A: signup path, settings, wards --------------------------
  const adminA = await login(email("admin-a"));
  ok("new user has no staff row", (await api.fetchStaffForUser(adminA.id)) === null);
  ok("new user has no invite to claim", (await api.claimInvite()) === null);

  const hospitalAId = await api.createHospital({
    hospitalName: "E2E Alpha Hospital",
    adminName: "Alice Admin",
    wardName: "Ward A1",
  });
  ok("createHospital returns an id", typeof hospitalAId === "string" && hospitalAId.length > 30);

  const me = await api.fetchStaffForUser(adminA.id);
  ok("creator becomes an active admin", me?.role === "admin" && me.active && me.initials === "AA");

  let bundle = await api.loadWardBundle();
  ok("bundle has hospital, one ward, one staff",
    bundle.hospital.name === "E2E Alpha Hospital" && bundle.wards.length === 1 && bundle.staff.length === 1);
  ok("hospital starts with default thresholds and UTC",
    bundle.hospital.settings.timezone === "UTC" &&
      bundle.hospital.settings.alertThresholds?.oxygen?.urgentBelow === 90);

  const icuId = await api.createWard("ICU");
  await api.renameWard(icuId, "ICU East");
  await rejects("duplicate ward name is refused", api.createWard("ICU East"), /already exists/i);
  await api.updateHospitalSettings({
    name: "E2E Alpha General",
    settings: {
      timezone: "Asia/Kolkata",
      alertThresholds: { oxygen: { urgentBelow: 85, warningBelow: 92 } },
    },
  });
  bundle = await api.loadWardBundle();
  ok("wards and settings saved and re-read",
    bundle.wards.map((w) => w.name).sort().join("|") === "ICU East|Ward A1" &&
      bundle.hospital.name === "E2E Alpha General" &&
      bundle.hospital.settings.timezone === "Asia/Kolkata" &&
      bundle.hospital.settings.alertThresholds?.oxygen?.urgentBelow === 85);
  await rejects("unknown setting key is refused",
    api.updateHospitalSettings({ settings: { evil: 1 } as never }), /unknown setting/i);
  const wardA1 = bundle.wards.find((w) => w.name === "Ward A1")!.id;

  // ---- Invites and claiming ----------------------------------------------
  await api.inviteStaff({ email: email("doctor-a"), name: "Dr Dana Doctor", role: "doctor", detail: "Attending", initials: "" });
  await api.inviteStaff({ email: email("nurse-a"), name: "Nate Nurse", role: "nurse", detail: "Day shift", initials: "" });
  const pending = await api.loadInvites();
  ok("two pending invitations are listed", pending.length === 2 && pending.every((i) => i.status === "pending"));

  const docUser = await login(email("doctor-a"));
  ok("invited doctor claims their invite", (await api.claimInvite()) !== null);
  const doc = await api.fetchStaffForUser(docUser.id);
  ok("doctor joined hospital A as a doctor", doc?.role === "doctor" && doc.name === "Dr Dana Doctor");
  const nurseUser = await login(email("nurse-a"));
  await api.claimInvite();
  const nurse = await api.fetchStaffForUser(nurseUser.id);
  ok("nurse joined hospital A as a nurse", nurse?.role === "nurse");
  ok("claiming twice is harmless", (await api.claimInvite()) === nurse!.id);

  await login(email("admin-a"));
  ok("claimed invitations are no longer pending", (await api.loadInvites()).length === 0);

  // ---- Clinical workflow (doctor admits, nurse records, etc.) ------------
  await login(email("doctor-a"));
  const patientId = await api.admitPatient({
    name: "Pat Alpha", age: 61, room: "A-101", diagnosis: "Pneumonia",
    allergy: "Penicillin", wardId: wardA1, doctorId: doc!.id, nurseId: nurse!.id,
  });
  bundle = await api.loadWardBundle();
  let p = bundle.data.patients.find((x) => x.id === patientId);
  ok("admitted patient maps correctly",
    p?.name === "Pat Alpha" && p.age === 61 && p.wardId === wardA1 &&
      p.doctorId === doc!.id && p.nurseId === nurse!.id && p.status === "stable" && p.allergy === "Penicillin");

  await login(email("nurse-a"));
  let r = await api.recordVitals({
    patientId, note: "baseline",
    vitals: { oxygen: 88, heartRate: 80, bp: "120/80", temperature: 37.2, respiratory: 16 },
  });
  ok("88% oxygen is only a WARNING under hospital A's custom 85/92 limits", r.abnormalCount === 1 && r.alertId !== null);
  bundle = await api.loadWardBundle();
  p = bundle.data.patients.find((x) => x.id === patientId);
  ok("vitals are stored as numbers and patient status follows the alert",
    p?.vitals.oxygen === 88 && p.vitals.heartRate === 80 && p.vitals.bp === "120/80" &&
      p.vitals.temperature === 37.2 && p.status === "warning");
  const warnAlert = bundle.data.alerts.find((a) => a.id === r.alertId);
  ok("alert has warning severity and readable message",
    warnAlert?.severity === "warning" && /Oxygen saturation 88%/.test(warnAlert.message));

  r = await api.recordVitals({
    patientId,
    vitals: { oxygen: 80, heartRate: 80, bp: "120/80", temperature: 37.2, respiratory: 16 },
  });
  bundle = await api.loadWardBundle();
  ok("80% oxygen is urgent and escalates the patient",
    bundle.data.patients.find((x) => x.id === patientId)?.status === "urgent");

  for (const a of bundle.data.alerts.filter((x) => x.status === "active")) {
    await api.setAlertStatus(a.id, "acknowledged");
    await api.setAlertStatus(a.id, "resolved");
  }
  bundle = await api.loadWardBundle();
  ok("resolving all alerts returns the patient to stable",
    bundle.data.patients.find((x) => x.id === patientId)?.status === "stable" &&
      bundle.data.alerts.every((x) => x.status === "resolved"));

  await login(email("doctor-a"));
  const taskId = await api.createTask({ patientId, title: "Recheck oxygen", due: "In 15 minutes", priority: "urgent" });
  const medId = await api.orderMedication({ patientId, name: "Ceftriaxone", dose: "1 g IV", due: "12:00" });
  await api.addNote({ patientId, type: "Doctor note", content: "Continue monitoring." });
  await login(email("nurse-a"));
  await api.completeTask(taskId);
  await api.administerMedication(medId);
  await rejects("a nurse cannot order medication", api.orderMedication({ patientId, name: "X", dose: "Y", due: "" }), /not allowed/i);
  await rejects("completing a task twice is refused", api.completeTask(taskId), /already/i);
  bundle = await api.loadWardBundle();
  ok("task, medication and note states are stored",
    bundle.data.tasks.find((t) => t.id === taskId)?.status === "completed" &&
      bundle.data.medications.find((m) => m.id === medId)?.status === "administered" &&
      bundle.data.notes.some((n) => n.author === "Dr Dana Doctor" && n.type === "Doctor note"));
  ok("timeline recorded the workflow",
    bundle.data.timeline.some((e) => /recorded new vitals/.test(e.summary)) &&
      bundle.data.timeline.some((e) => /completed task/.test(e.summary)) &&
      bundle.data.timeline.some((e) => /administered Ceftriaxone/.test(e.summary)));

  await login(email("doctor-a"));
  await api.updatePatient({
    patientId, name: "Pat Alpha", age: 61, room: "A-102", diagnosis: "Pneumonia",
    allergy: "Penicillin", wardId: wardA1, doctorId: doc!.id, nurseId: nurse!.id,
  });
  await login(email("nurse-a"));
  await rejects("a nurse cannot change the care team",
    api.updatePatient({ patientId, name: "Pat Alpha", age: 61, room: "A-102", diagnosis: "Pneumonia",
      allergy: "Penicillin", wardId: wardA1, doctorId: "", nurseId: nurse!.id }), /only doctors and admins/i);

  // ---- Admin views -------------------------------------------------------
  await login(email("admin-a"));
  const audit = await api.loadAuditEvents(200);
  ok("audit log lists the actions with actor names",
    audit.length >= 15 && audit.some((e) => e.action === "record_vitals" && e.actorName === "Nate Nurse"),
    `events=${audit.length}`);
  await api.updateStaff({ id: nurse!.id, name: "Nate Nurse", role: "nurse", detail: "Night shift", initials: "NN" });
  bundle = await api.loadWardBundle();
  ok("admin can edit staff", bundle.staff.find((s) => s.id === nurse!.id)?.detail === "Night shift");
  await login(email("nurse-a"));
  await api.updateMyProfile({ name: "Nate N. Nurse", detail: "Night shift", initials: "NN" });
  ok("users can edit their own profile", (await api.fetchStaffForUser(nurseUser.id))?.name === "Nate N. Nurse");
  await rejects("non-admin cannot invite", api.inviteStaff({ email: "x@example.com", name: "X", role: "nurse", detail: "", initials: "" }), /only hospital admins/i);
  ok("non-admin sees no audit log", (await api.loadAuditEvents(10)).length === 0);

  // ---- Hospital B and isolation through the real API ---------------------
  await login(email("admin-b"));
  await api.createHospital({ hospitalName: "E2E Beta Hospital", adminName: "Bob Admin" });
  const bundleB = await api.loadWardBundle();
  ok("hospital B sees none of hospital A's data",
    bundleB.hospital.name === "E2E Beta Hospital" && bundleB.data.patients.length === 0 &&
      bundleB.data.alerts.length === 0 && bundleB.data.timeline.length === 0 && bundleB.staff.length === 1);
  await rejects("hospital B cannot create a task for A's patient",
    api.createTask({ patientId, title: "x", due: "", priority: "routine" }), /not found/i);
  await rejects("hospital B cannot add a note to A's patient", api.addNote({ patientId, type: "", content: "x" }), /not found/i);

  // ---- Deactivation and the last-admin guard -----------------------------
  await login(email("admin-a"));
  await rejects("the only admin cannot deactivate themselves", api.setStaffActive(me!.id, false), /at least one active admin/i);
  await api.setStaffActive(nurse!.id, false);
  await login(email("nurse-a"));
  ok("a deactivated user loses their staff row and data",
    (await api.fetchStaffForUser(nurseUser.id)) === null);
  await rejects("a deactivated user cannot load the ward", api.loadWardBundle(), /no hospital/i);
  await login(email("admin-a"));
  await api.setStaffActive(nurse!.id, true);
  await login(email("nurse-a"));
  ok("reactivating restores access", (await api.fetchStaffForUser(nurseUser.id))?.active === true);

  // ---- No login -----------------------------------------------------------
  const anon = createClient(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const readAnon = await anon.from("patients").select("id").limit(1);
  ok("anonymous users cannot read patients", readAnon.error !== null || (readAnon.data ?? []).length === 0,
    JSON.stringify(readAnon));
  const rpcAnon = await anon.rpc("claim_invite");
  ok("anonymous users cannot call functions", rpcAnon.error !== null);

  // ---- Real sign-up (informational: depends on the project's email settings)
  const signupClient = createClient(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const su = await signupClient.auth.signUp({ email: email("signup-probe"), password: PASSWORD! });
  console.log(
    `INFO  real signUp -> ${su.error ? `error: ${su.error.message}` : `ok, session=${su.data.session ? "yes (auto-confirmed)" : "no (email confirmation required)"}`}`,
  );

  const failed = results.filter((x) => !x.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("Failed:\n" + failed.map((f) => ` - ${f.name}${f.detail ? ` (${f.detail})` : ""}`).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFlow aborted:", err);
  process.exit(1);
});
