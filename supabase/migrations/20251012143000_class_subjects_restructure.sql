-- Re-create the has_role function to ensure it exists in the current transaction
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 1: Create the new 'class_subjects' junction table to link classes, subjects, and teachers.
CREATE TABLE public.class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (class_id, subject_id) -- A subject can only be added once to a class
);

-- Enable RLS for the new table
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

-- Step 2: Modify 'attendance' table to link to 'class_subjects'.
-- First, drop ALL policies on 'attendance' that might depend on 'class_id'
DROP POLICY IF EXISTS "Teachers can view their class attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can insert attendance for their classes" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can manage records for their class" ON public.attendance; -- This is the problematic policy
DROP POLICY IF EXISTS "Admins can manage all attendance" ON public.attendance;


-- Then, drop constraints that depend on the old 'class_id' column
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_class_id_fkey;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_unique_record;

-- Add the new 'class_subject_id' column
ALTER TABLE public.attendance ADD COLUMN class_subject_id UUID REFERENCES public.class_subjects(id) ON DELETE CASCADE;

-- Drop the old 'class_id' column as it's now redundant
ALTER TABLE public.attendance DROP COLUMN IF EXISTS class_id;

-- Add a new unique constraint based on the new structure
ALTER TABLE public.attendance ADD CONSTRAINT attendance_unique_record UNIQUE (student_id, class_subject_id, date, lesson_period);


-- Step 3: Clean up old, redundant columns from other tables.
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_teacher_id_fkey;
ALTER TABLE public.classes DROP COLUMN IF EXISTS teacher_id;
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_subject_id_fkey;
ALTER TABLE public.classes DROP COLUMN IF EXISTS subject_id;
ALTER TABLE public.teachers DROP COLUMN IF EXISTS subject;


-- Step 4: Create RLS policies for the new 'class_subjects' table.
CREATE POLICY "Admins can manage class subjects" ON public.class_subjects FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view class subjects" ON public.class_subjects FOR SELECT USING (auth.role() = 'authenticated');


-- Step 5: Update existing RLS policies to work with the new structure.

-- STUDENTS --
DROP POLICY IF EXISTS "Teachers can view their class students" ON public.students;
CREATE POLICY "Teachers can view students in their assigned classes" ON public.students FOR SELECT USING (EXISTS (SELECT 1 FROM public.teachers t JOIN public.class_subjects cs ON t.id = cs.teacher_id WHERE t.profile_id = auth.uid() AND cs.class_id = students.class_id));

-- ATTENDANCE --
-- Re-create policies for attendance with the new structure
CREATE POLICY "Admins can manage all attendance" ON public.attendance FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Teachers can view attendance in their assigned class subjects" ON public.attendance FOR SELECT USING (EXISTS (SELECT 1 FROM public.class_subjects cs JOIN public.teachers t ON cs.teacher_id = t.id WHERE cs.id = attendance.class_subject_id AND t.profile_id = auth.uid()));
CREATE POLICY "Teachers can insert attendance for their assigned class subjects" ON public.attendance FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.class_subjects cs JOIN public.teachers t ON cs.teacher_id = t.id WHERE cs.id = attendance.class_subject_id AND t.profile_id = auth.uid()));

-- DISCIPLINE RECORDS --
DROP POLICY IF EXISTS "Teachers can view their class discipline records" ON public.discipline_records;
DROP POLICY IF EXISTS "Teachers can insert discipline records for their classes" ON public.discipline_records;
CREATE POLICY "Teachers can view discipline records in their assigned classes" ON public.discipline_records FOR SELECT USING (EXISTS (SELECT 1 FROM public.teachers t JOIN public.class_subjects cs ON t.id = cs.teacher_id WHERE t.profile_id = auth.uid() AND cs.class_id = discipline_records.class_id));
CREATE POLICY "Teachers can insert discipline records for their assigned classes" ON public.discipline_records FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.teachers t JOIN public.class_subjects cs ON t.id = cs.teacher_id WHERE t.profile_id = auth.uid() AND cs.class_id = discipline_records.class_id));

