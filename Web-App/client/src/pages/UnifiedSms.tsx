import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDevices } from '../contexts/DeviceContext';
import { SMS } from '../types';
import {
    getDeviceNumberMap,
    getSimLabelForSms,
    getTransactionKind,
    isTransactionMessage,
    parseTransaction,
    formatINR,
} from '../utils/transactions';

interface UnifiedSms extends SMS {
    deviceId: string;
    deviceName: string;
    deviceStatus: string;
}

type TypeFilter = 'all' | 'incoming' | 'outgoing';
type TxnFilter = 'all' | 'money' | 'credit' | 'debit';

export default function UnifiedSms() {
    const { devices, deviceData, getDeviceData } = useDevices();
    const navigate = useNavigate();

    const [query, setQuery] = useState('');
    const [deviceFilter, setDeviceFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [txnFilter, setTxnFilter] = useState<TxnFilter>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [forwardDraft, setForwardDraft] = useState('');

    // Pull data for every known device so the unified view is complete.
    useEffect(() => {
        devices.forEach((d) => getDeviceData(d.id));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [devices.length]);

    const numberMap = useMemo(() => getDeviceNumberMap(devices), [devices]);

    const all: UnifiedSms[] = useMemo(() => {
        const out: UnifiedSms[] = [];
        deviceData.forEach((data, deviceId) => {
            const dev = devices.find((d) => d.id === deviceId);
            for (const sms of data.sms) {
                out.push({
                    ...sms,
                    deviceId,
                    deviceName: dev?.name || deviceId.slice(0, 8),
                    deviceStatus: dev?.status || 'offline',
                });
            }
        });
        return out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [deviceData, devices]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return all.filter((sms) => {
            if (deviceFilter !== 'all' && sms.deviceId !== deviceFilter) return false;
            if (typeFilter !== 'all' && sms.type !== typeFilter) return false;
            if (txnFilter !== 'all') {
                if (txnFilter === 'money' && !isTransactionMessage(sms.message)) return false;
                if ((txnFilter === 'credit' || txnFilter === 'debit') && getTransactionKind(sms.message) !== txnFilter) return false;
            }
            if (!q) return true;
            const party = (sms.type === 'incoming' ? sms.sender : sms.receiver).toLowerCase();
            return (
                sms.message.toLowerCase().includes(q) ||
                party.includes(q) ||
                sms.deviceName.toLowerCase().includes(q)
            );
        });
    }, [all, query, deviceFilter, typeFilter, txnFilter]);

    const selected = selectedId ? all.find((s) => `${s.deviceId}:${s.id}` === selectedId) || null : null;

    const simsForSelected = useMemo(() => {
        if (!selected) return [];
        const dev = devices.find((d) => d.id === selected.deviceId);
        const data = deviceData.get(selected.deviceId);
        return dev?.simCards || data?.simCards || [];
    }, [selected, devices, deviceData]);

    return (
        <>
            <div className="page-head">
                <div>
                    <h2 className="page-title">💬 All SMS ({filtered.length}/{all.length})</h2>
                    <p className="page-subtitle">Unified inbox across every connected device. Select a message to open, reply or forward it.</p>
                </div>
            </div>

            <div className="toolbar">
                <div className="search-wrap">
                    <span className="search-icon">🔍</span>
                    <input
                        className="form-input search-input"
                        placeholder="Search all messages — text, sender, number, device…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                        <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">✕</button>
                    )}
                </div>
                <div className="toolbar-filters">
                    <select className="form-input sort-select" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)} aria-label="Filter by device">
                        <option value="all">All devices</option>
                        {devices.map((d) => (
                            <option key={d.id} value={d.id}>
                                #{numberMap.get(d.id) ?? '?'} {d.name} ({d.status})
                            </option>
                        ))}
                    </select>
                    <div className="segmented">
                        {(['all', 'incoming', 'outgoing'] as TypeFilter[]).map((t) => (
                            <button key={t} className={`segmented-btn ${typeFilter === t ? 'active' : ''}`} onClick={() => setTypeFilter(t)}>
                                {t === 'all' ? 'All' : t === 'incoming' ? '📥 In' : '📤 Out'}
                            </button>
                        ))}
                    </div>
                    <div className="segmented">
                        {([
                            ['all', 'All'],
                            ['money', '💰 Money'],
                            ['credit', '↑ Credit'],
                            ['debit', '↓ Debit'],
                        ] as [TxnFilter, string][]).map(([v, label]) => (
                            <button key={v} className={`segmented-btn ${txnFilter === v ? 'active' : ''}`} onClick={() => setTxnFilter(v)}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="split">
                <div className="glass-card split-list">
                    {filtered.length === 0 ? (
                        <div className="empty-state" style={{ padding: '2rem' }}>
                            <div className="empty-state-icon">💬</div>
                            <h2>No messages found</h2>
                            <p>Try a different search, or sync a device to pull fresh SMS.</p>
                        </div>
                    ) : (
                        <div className="data-list">
                            {filtered.slice(0, 300).map((sms) => {
                                const key = `${sms.deviceId}:${sms.id}`;
                                const txn = isTransactionMessage(sms.message) ? parseTransaction(sms.message) : null;
                                const simLabel = getSimLabelForSms(
                                    sms,
                                    devices.find((d) => d.id === sms.deviceId)?.simCards ||
                                        deviceData.get(sms.deviceId)?.simCards ||
                                        [],
                                );
                                return (
                                    <div
                                        key={key}
                                        className={`data-item selectable ${selectedId === key ? 'selected' : ''}`}
                                        onClick={() => { setSelectedId(key); setForwardDraft(sms.message); }}
                                    >
                                        <div className={`data-item-icon ${sms.type}`}>
                                            {sms.type === 'incoming' ? '📥' : '📤'}
                                        </div>
                                        <div className="data-item-content">
                                            <div className="data-item-header">
                                                <span className="data-item-title">
                                                    {sms.type === 'incoming' ? sms.sender : sms.receiver}
                                                </span>
                                                <span className="data-item-time">
                                                    {new Date(sms.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="data-item-body clamp-2">{sms.message}</div>
                                            <div className="data-item-meta">
                                                <button
                                                    className="link-chip"
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/device/${sms.deviceId}`); }}
                                                    title="Open device"
                                                >
                                                    #{numberMap.get(sms.deviceId) ?? '?'} {sms.deviceName}
                                                </button>
                                                <span className={`badge ${sms.deviceStatus === 'online' ? 'badge-success' : 'badge-danger'}`}>
                                                    {sms.deviceStatus}
                                                </span>
                                                {txn && (
                                                    <span className={`badge ${txn.kind === 'credit' ? 'badge-success' : txn.kind === 'debit' ? 'badge-danger' : 'badge-warning'}`}>
                                                        💰 {txn.kind}{txn.amount !== null ? ` ${formatINR(txn.amount)}` : ''}
                                                    </span>
                                                )}
                                                {simLabel && <span className="badge">📶 {simLabel}</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {filtered.length > 300 && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                            Showing newest 300 of {filtered.length} — refine the search to narrow results.
                        </p>
                    )}
                </div>

                <div className="glass-card split-detail">
                    {!selected ? (
                        <div className="empty-state" style={{ padding: '2rem' }}>
                            <div className="empty-state-icon">👈</div>
                            <h2>Select a message</h2>
                            <p>Click any SMS on the left to preview it here and jump to its device to reply or forward.</p>
                        </div>
                    ) : (
                        <>
                            <h3 className="section-title">
                                {selected.type === 'incoming' ? '📥' : '📤'}{' '}
                                {selected.type === 'incoming' ? selected.sender : selected.receiver}
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                #{numberMap.get(selected.deviceId) ?? '?'} {selected.deviceName} ·{' '}
                                {new Date(selected.timestamp).toLocaleString()}
                            </p>
                            <div className="message-preview">{selected.message}</div>
                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label className="form-label">Forward / edit before sending</label>
                                <textarea
                                    className="form-input"
                                    rows={4}
                                    value={forwardDraft}
                                    onChange={(e) => setForwardDraft(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <Link className="btn btn-primary" to={`/device/${selected.deviceId}?tab=sendsms&to=${encodeURIComponent(selected.type === 'incoming' ? selected.sender : selected.receiver)}&body=${encodeURIComponent(forwardDraft)}`}>
                                    📤 Open device to send
                                </Link>
                                <Link className="btn btn-secondary" to={`/device/${selected.deviceId}`}>
                                    📲 View device
                                </Link>
                            </div>
                            {simsForSelected.length > 0 && (
                                <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    📶 Send via:{' '}
                                    {simsForSelected.map((s, i) => (
                                        <span key={i} className="sim-chip" style={{ marginRight: '0.35rem' }}>
                                            SIM {s.slotIndex + 1} · {s.carrierName}
                                        </span>
                                    ))}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                        Pick the SIM on the device page — dual-SIM devices list every slot.
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
