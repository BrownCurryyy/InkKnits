import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StationWorkspace } from './StationWorkspace';
import { CozySkeleton } from './UIStates';
import type { AssetRecord, StationRecord } from '../types';

export function StationPage() {
  const { stationId } = useParams<{ stationId: string }>();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [station, setStation] = useState<StationRecord | null>(null);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

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
      {toast ? <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-[#423838] px-5 py-3.5 text-sm font-medium text-[#FFF2C2] shadow-cozy">{toast}</div> : null}
    </>
  );
}
