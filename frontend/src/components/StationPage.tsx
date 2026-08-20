import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StationWorkspace } from './StationWorkspace';
import { CozySkeleton } from './UIStates';
import type { AssetRecord, StationRecord, UserRecord } from '../types';

export function StationPage() {
  const { stationId } = useParams<{ stationId: string }>();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const [station, setStation] = useState<StationRecord | null>(null);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [orgMembers, setOrgMembers] = useState<UserRecord[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberPanelOpen, setMemberPanelOpen] = useState(false);

  const loadData = async () => {
    if (!stationId) return;
    try {
      setLoading(true);
      setError('');
      const stations = await apiFetch<StationRecord[]>('/stations');
      const currentStation = stations.find((item) => item.id === stationId);
      if (!currentStation) {
        setError('Station not found');
        return;
      }
      const allAssets = await apiFetch<AssetRecord[]>('/assets');
      setStation(currentStation);
      setStations(stations);
      setAssets(allAssets.filter((asset) => asset.station_id === stationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load station workspace');
    } finally {
      setLoading(false);
    }
  };

  const openMemberPanel = async () => {
    if (!station || !user) return;
    try {
      const members = await apiFetch<UserRecord[]>(`/organizations/${user.organization_id}/members`);
      setOrgMembers(members);
      setMemberPanelOpen(true);
    } catch {
      setToast('Unable to load organization members.');
    }
  };

  const addMember = async () => {
    if (!station || !selectedMemberId) return;
    try {
      await apiFetch(`/stations/${station.id}/members`, {
        method: 'POST',
        body: { user_id: selectedMemberId },
      });
      setMemberPanelOpen(false);
      setSelectedMemberId('');
      setToast('Member added to station.');
    } catch {
      setToast('Unable to add member to station.');
    }
  };

  useEffect(() => {
    void loadData();
  }, [stationId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (loading) return <CozySkeleton rows={4} />;

  if (error || !station) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => navigate('/')} className="text-sm font-semibold text-accent hover:underline">
          ← Back to Home
        </button>
        <div className="rounded-2xl border border-statusError/60 bg-statusError/20 p-4 text-sm font-semibold shadow-cozy">
          {error || 'Station not found.'}
        </div>
      </div>
    );
  }

  return (
    <>
      <StationWorkspace
        station={station}
        assets={assets}
        allStations={stations}
        canWrite={roles.some((role) => ['ADMIN', 'EDITOR'].includes(role.toUpperCase()))}
        onSelectAsset={(id) => navigate(`/assets/${id}`)}
        onRefresh={loadData}
        onShowToast={setToast}
      />
      {roles.some((role) => ['ADMIN', 'MANAGER'].includes(role.toUpperCase())) ? (
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={() => void openMemberPanel()} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark">
            Add member
          </button>
        </div>
      ) : null}
      {memberPanelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#423838]/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-cozy dark:bg-[#2d2222]">
            <h3 className="text-lg font-bold">Add station member</h3>
            <select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)} className="mt-4 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#4f3d3d]">
              <option value="">Select organization member...</option>
              {orgMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name} · {member.email}</option>)}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setMemberPanelOpen(false)} className="rounded-xl bg-white px-4 py-2 text-xs font-bold dark:bg-[#554949]">Cancel</button>
              <button type="button" onClick={() => void addMember()} disabled={!selectedMemberId} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-backgroundDark disabled:opacity-50">Add member</button>
            </div>
          </div>
        </div>
      ) : null}
      {toast ? <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-[#423838] px-5 py-3.5 text-sm font-medium text-[#FFF2C2] shadow-cozy">{toast}</div> : null}
    </>
  );
}
