import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GraduationCap } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

function fullName(e) {
  return [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.employeeCode || '—';
}

export default function HrTrainingPage() {
  const qc = useQueryClient();
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['hr', 'courses'],
    queryFn: () => hrApi.trainingCourses(),
  });
  const { data: enrollments = [] } = useQuery({
    queryKey: ['hr', 'enrollments'],
    queryFn: () => hrApi.trainingEnrollments(),
  });
  const { data: employeesData } = useQuery({
    queryKey: ['hr', 'employees', 'train-picker'],
    queryFn: () => hrApi.employees({ limit: 100, status: 'active' }),
  });
  const [courseForm, setCourseForm] = useState({ title: '', category: 'general', durationHours: 2, videoUrl: '' });
  const [enrollForm, setEnrollForm] = useState({ courseId: '', employeeId: '' });
  const employees = employeesData?.rows || [];

  const addCourse = async () => {
    if (!courseForm.title.trim()) return;
    await hrApi.createCourse(courseForm);
    setCourseForm({ title: '', category: 'general', durationHours: 2, videoUrl: '' });
    qc.invalidateQueries({ queryKey: ['hr', 'courses'] });
  };

  const enroll = async () => {
    if (!enrollForm.courseId || !enrollForm.employeeId) return;
    await hrApi.enrollTraining(enrollForm);
    setEnrollForm({ courseId: '', employeeId: '' });
    qc.invalidateQueries({ queryKey: ['hr', 'enrollments'] });
  };

  const bumpProgress = async (id, pct) => {
    await hrApi.updateEnrollment(id, { progressPct: pct });
    qc.invalidateQueries({ queryKey: ['hr', 'enrollments'] });
  };

  const removeCourse = async (id) => {
    if (!window.confirm('Archive course?')) return;
    await hrApi.deleteCourse(id);
    qc.invalidateQueries({ queryKey: ['hr', 'courses'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Training"
        description="Courses, enrollments and completion tracking"
        breadcrumbs={['HR', 'Training']}
      />

      <div className="grid gap-3 rounded-2xl border border-subtle bg-white p-4 shadow-sm md:grid-cols-4">
        <input value={courseForm.title} onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))} placeholder="Course title" className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" />
        <input value={courseForm.category} onChange={(e) => setCourseForm((f) => ({ ...f, category: e.target.value }))} placeholder="Category" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input type="number" value={courseForm.durationHours} onChange={(e) => setCourseForm((f) => ({ ...f, durationHours: Number(e.target.value) }))} placeholder="Hours" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <Button onClick={addCourse} className="h-10 rounded-xl bg-[#5D5FEF] text-white md:col-span-4"><Plus className="mr-1 h-4 w-4" /> Add Course</Button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-violet-100 bg-violet-50/40 p-4 md:grid-cols-3">
        <select value={enrollForm.courseId} onChange={(e) => setEnrollForm((f) => ({ ...f, courseId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">Select course</option>
          {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
        </select>
        <select value={enrollForm.employeeId} onChange={(e) => setEnrollForm((f) => ({ ...f, employeeId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">Select employee</option>
          {employees.map((e) => <option key={e._id} value={e._id}>{fullName(e)}</option>)}
        </select>
        <Button onClick={enroll} variant="outline" className="h-10 rounded-xl border-violet-200 bg-white text-violet-700">Enroll</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-subtle bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Courses</h3>
          {isLoading ? <p className="text-sm text-slate-400">Loading…</p> : courses.length === 0 ? (
            <p className="text-sm text-slate-400">No courses yet</p>
          ) : (
            <ul className="space-y-2">
              {courses.map((c) => (
                <li key={c._id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-violet-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{c.title}</p>
                      <p className="text-[11px] text-slate-400">{c.category} · {c.durationHours}h</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeCourse(c._id)} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-subtle bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Enrollments</h3>
          {enrollments.length === 0 ? (
            <p className="text-sm text-slate-400">No enrollments yet</p>
          ) : (
            <ul className="space-y-3">
              {enrollments.map((e) => (
                <li key={e._id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{fullName(e.employeeId)}</p>
                      <p className="text-[11px] text-slate-400">{e.courseId?.title}</p>
                    </div>
                    <span className={cn(
                      'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
                      e.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'
                    )}>{e.status?.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#5D5FEF]" style={{ width: `${e.progressPct || 0}%` }} />
                  </div>
                  <div className="mt-2 flex gap-1">
                    {[25, 50, 75, 100].map((p) => (
                      <button key={p} type="button" onClick={() => bumpProgress(e._id, p)} className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                        {p}%
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
