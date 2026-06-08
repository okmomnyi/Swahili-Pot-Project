import { useEffect, useState } from 'react';
import { ClipboardCheck, FileDown } from 'lucide-react';
import { getSupervisorAttendance } from '../../api/attendance';
import { useAuth } from '../../context/AuthContext';
import { formatEAT } from '../../lib/datetime';
import { exportTablePdf } from '../../lib/pdf';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const DT = 'dd MMM yyyy, HH:mm';

export default function SupervisorAttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSupervisorAttendance()
      .then((res) => setRecords(res.data.records))
      .finally(() => setLoading(false));
  }, []);

  function handleExport() {
    exportTablePdf({
      title: 'Department Attendance',
      subtitle: `${user.department_name} Department`,
      meta: [`Records: ${records.length}`],
      columns: ['#', 'Trainee', 'Phone', 'Session', 'Instructor', 'Check-in', 'Check-out', 'Confirmed'],
      rows: records.map((r, i) => [
        i + 1,
        r.trainee_name,
        r.trainee_phone,
        r.session_label || 'Unnamed',
        r.instructor_name,
        r.check_in ? formatEAT(r.check_in, DT) : '—',
        r.check_out ? formatEAT(r.check_out, DT) : 'Not yet',
        r.is_confirmed ? 'Yes' : 'No',
      ]),
      filename: 'department-attendance',
    });
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Attendance</h2>
          <p className="mt-1 text-sm text-subtle">
            All trainee check-ins across {user.department_name} Department
          </p>
        </div>
        <Button variant="secondary" onClick={handleExport} disabled={records.length === 0}>
          <FileDown size={16} /> Export PDF
        </Button>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No attendance yet"
          description="Records appear here as trainees check in via instructor QR codes."
        />
      ) : (
        <Table>
          <THead>
            <TH>Trainee</TH>
            <TH>Phone</TH>
            <TH>Session</TH>
            <TH>Instructor</TH>
            <TH>Check-in (EAT)</TH>
            <TH>Check-out (EAT)</TH>
            <TH>Confirmed</TH>
          </THead>
          <TBody>
            {records.map((r, i) => (
              <TR key={r.id} index={i}>
                <TD className="font-medium">{r.trainee_name}</TD>
                <TD>{r.trainee_phone}</TD>
                <TD>{r.session_label || 'Unnamed Session'}</TD>
                <TD>{r.instructor_name}</TD>
                <TD>{r.check_in ? formatEAT(r.check_in, DT) : '—'}</TD>
                <TD>
                  {r.check_out ? (
                    formatEAT(r.check_out, DT)
                  ) : (
                    <span className="text-[#6b7280]">Not yet</span>
                  )}
                </TD>
                <TD>
                  <Badge status={r.is_confirmed ? 'confirmed' : 'pending'} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
