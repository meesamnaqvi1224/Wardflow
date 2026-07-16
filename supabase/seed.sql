-- WardFlow demo seed — fictional patients only.
-- Run after schema.sql

insert into staff (id, name, role, detail, initials) values
  ('doctor-1', 'Dr. Sarah Khan', 'doctor', 'Attending physician', 'SK'),
  ('doctor-2', 'Dr. Omar Siddiqui', 'doctor', 'Ward physician', 'OS'),
  ('nurse-1', 'Nurse Alex Morgan', 'nurse', 'Day shift', 'AM'),
  ('nurse-2', 'Nurse Priya Nair', 'nurse', 'Day shift', 'PN'),
  ('admin-1', 'Jordan Lee', 'admin', 'Ward administrator', 'JL')
on conflict (id) do nothing;

insert into patients (
  id, name, age, room, diagnosis, allergy, status, doctor_id, nurse_id,
  admitted_on, oxygen, heart_rate, bp, temperature, respiratory, updated_at
) values
  ('p1', 'Maya Patel', 67, '204-B', 'Pneumonia', 'Penicillin', 'urgent', 'doctor-1', 'nurse-1', '2026-06-04', 89, 112, '128/82', 38.4, 25, now()),
  ('p2', 'Robert Allen', 54, '208-A', 'Post-operative recovery', 'None recorded', 'warning', 'doctor-1', 'nurse-1', '2026-06-04', 96, 102, '139/88', 38.2, 20, now()),
  ('p3', 'Elena Garcia', 42, '206-A', 'Acute asthma', 'Ibuprofen', 'stable', 'doctor-1', 'nurse-1', '2026-06-04', 97, 84, '118/76', 37.1, 18, now()),
  ('p4', 'Noah Williams', 73, '202-C', 'Heart failure observation', 'Latex', 'warning', 'doctor-1', 'nurse-2', '2026-06-04', 94, 98, '152/91', 36.9, 22, now()),
  ('p5', 'Aisha Rahman', 29, '210-A', 'Severe dehydration', 'None recorded', 'stable', 'doctor-2', 'nurse-1', '2026-06-04', 99, 88, '111/72', 37.0, 16, now()),
  ('p6', 'Daniel Kim', 61, '205-B', 'Diabetic foot infection', 'Sulfa drugs', 'stable', 'doctor-2', 'nurse-2', '2026-06-04', 98, 80, '126/80', 37.4, 17, now()),
  ('p7', 'Priya Sharma', 35, '207-A', 'Appendicitis observation', 'None recorded', 'stable', 'doctor-1', 'nurse-2', '2026-06-04', 99, 78, '116/75', 37.2, 15, now()),
  ('p8', 'James Walker', 48, '209-B', 'Cellulitis', 'Amoxicillin', 'stable', 'doctor-2', 'nurse-1', '2026-06-04', 98, 82, '124/79', 37.5, 16, now())
on conflict (id) do nothing;

insert into alerts (id, patient_id, severity, message, status) values
  ('a1', 'p1', 'urgent', 'Oxygen saturation 89% is below threshold', 'active'),
  ('a2', 'p2', 'warning', 'Temperature 38.2°C is above threshold', 'active'),
  ('a3', 'p4', 'warning', 'Oxygen saturation 94% is below threshold', 'acknowledged')
on conflict (id) do nothing;

insert into tasks (id, patient_id, title, due_label, priority, status) values
  ('t1', 'p1', 'Recheck oxygen saturation', 'In 15 minutes', 'urgent', 'open'),
  ('t2', 'p2', 'Review surgical dressing', '11:30 AM', 'important', 'open'),
  ('t3', 'p3', 'Complete respiratory assessment', '12:00 PM', 'routine', 'open'),
  ('t4', 'p5', 'Repeat fluid balance', '1:00 PM', 'routine', 'open')
on conflict (id) do nothing;

insert into medications (id, patient_id, name, dose, due_label, status) values
  ('m1', 'p1', 'Ceftriaxone', '1 g IV', '12:00 PM', 'due'),
  ('m2', 'p1', 'Paracetamol', '500 mg oral', '2:00 PM', 'upcoming'),
  ('m3', 'p2', 'Enoxaparin', '40 mg SC', '11:30 AM', 'due'),
  ('m4', 'p3', 'Salbutamol', '2.5 mg nebulized', '1:00 PM', 'upcoming')
on conflict (id) do nothing;

insert into notes (id, patient_id, author_name, author_id, note_type, content) values
  ('n1', 'p1', 'Nurse Alex Morgan', 'nurse-1', 'Nursing note', 'Patient reports increasing shortness of breath on movement.'),
  ('n2', 'p1', 'Dr. Sarah Khan', 'doctor-1', 'Doctor note', 'Continue close oxygen monitoring and repeat reading after intervention.'),
  ('n3', 'p3', 'Nurse Alex Morgan', 'nurse-1', 'Nursing note', 'Breathing comfortable following morning nebulizer.')
on conflict (id) do nothing;

insert into timeline_events (id, patient_id, summary, event_type) values
  ('e1', 'p1', 'Nurse Alex recorded vitals: oxygen saturation 89%', 'urgent'),
  ('e2', 'p1', 'Urgent vital alert automatically created', 'urgent'),
  ('e3', 'p1', 'Dr. Sarah requested another oxygen reading', 'task'),
  ('e4', 'p2', 'Nurse Alex recorded temperature 38.2°C', 'warning'),
  ('e5', 'p3', 'Morning medication administered', 'medication'),
  ('e6', 'p4', 'Dr. Sarah acknowledged oxygen alert', 'alert')
on conflict (id) do nothing;
