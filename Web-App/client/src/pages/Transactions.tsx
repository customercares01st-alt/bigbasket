import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDevices } from '../contexts/DeviceContext';
import {
    BalanceInfo,
    formatINR,
    getDeviceNumberMap,
    getLatestBalance,
    isTransactionMessage,
    parseTransaction,
} from '../utils/transactions';

type KindFilter = 'all' | 'credit' | 'debit' | 'balance' | 'other';

export default function Transactions() {
    const { devices, deviceData, getDeviceData } = useDevices();
    const [params, setParams] = useSearchParams();
    const [query, setQuery] = useState('');
    const [kind, setKind] = useState<KindFilter>('all');
    const [deviceFilter, setDeviceFilter] = useState<string>(params.get('device') || 'all');

    useEffect(() => {
        devices.forEach((d) => getDeviceData(d.id));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [devices.length]);

    useEffect(() => {
        const d = params.get('device');
        if (d) setDeviceFilter(d);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params]);

    const numberMap = useMemo(() => getDeviceNumberMap(devices), [devices]);

    const balances: BalanceInfo[] = useMemo(() => {
        return devices
            .map((d) => {
                const data = deviceData.get(d.id);
                if (!data) return null;
                return getLatestBalance(data.sms, d.id, d.name);
            })
            .filter((b): b is BalanceInfo => b !== null)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [devices, deviceData]);

    const txns = useMemo(() => {
        const out: {
            key: string;
            deviceId: string;
            deviceName: string;
            sender: string;
            timestamp: string;
            message: string;
            kind: string;
            amount: number | null;
            balance: number | null;
        }[] = [];
        deviceData.forEach((data, deviceId) => {
            const dev = devices.find((d) => d.id === deviceId);
            for (const sms of data.sms) {
                if (!isTransactionMessage(sms.message)) continue;
                const parsed = parseTransaction(sms.message);
                out.push({
                    key: `${deviceId}:${sms.id}`,
                    deviceId,
                    deviceName: dev?.name || deviceId.slice(0, 8),
                    sender: sms.type === 'incoming' ? sms.sender : sms.receiver,
                    timestamp: sms.timestamp,
                    message: sms.message,
                    kind: parsed.kind,
                    amount: parsed.amount,
                    balance: parsed.balance,
                });
            }
        });
        return out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [deviceData, devices]);

    const totals = useMemo(() => {
        let credit = 0;
        let debit = 0;
        let nCredit = 0;
        let nDebit = 0;
        for (const t of txns) {
            if (deviceFilter !== 'all' && t.deviceId !== deviceFilter) continue;
            if (t.kind === 'credit' && t.amount !== null) { credit += t.amount; nCredit += 1; }
            if (t.kind === 'debit' && t.amount !== null) { debit += t.amount; nDebit += 1; }
        }
        return { credit, debit, net: credit - debit, nCredit, nDebit };
    }, [txns, deviceFilter]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return txns.filter((t) => {
            if (deviceFilter !== 'all' && t.deviceId !== deviceFilter) return false;
            if (kind !== 'all' && t.kind !== kind) return false;
            if (!q) return true;
            return (
                t.message.toLowerCase().includes(q) ||
                t.sender.toLowerCase().includes(q) ||
                t.deviceName.toLowerCase().includes(q)
            );
        });
    }, [txns, query, kind, deviceFilter]);

    return (
        <>
            <div className="page-head">
                <div>
                    <h2 className="page-title">💰 Money & Transactions</h2>
                    <p className="page-subtitle">
                        Every credit, debit and balance SMS across all devices — plus the latest known balance per device.
                    </p>
                </div>
            </div>

            <h3 className="section-title">🏦 Current balance per device</h3>
            {balances.length === 0 ? (
                <div className="glass-card empty-state" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <p>No balance figures found yet. Balances are extracted from bank SMS (e.g. “Available balance Rs 12,000”). Sync a device to populate this.</p>
                </div>
            ) : (
                <div className="balance-grid">
                    {balances
                        .filter((b) => deviceFilter === 'all' || b.deviceId === deviceFilter)
                        .map((b) => (
                            <div key={b.deviceId} className="glass-card balance-card">
                                <div className="balance-device">
                                    <span className="device-number-inline">#{numberMap.get(b.deviceId) ?? '?'}</span>{' '}
                                    {b.deviceName}
                                </div>
                                <div className="balance-amount">{formatINR(b.balance)}</div>
                                <div className="balance-meta">
                                    via {b.sender} · {new Date(b.timestamp).toLocaleString()}
                                </div>
                                <Link className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }} to={`/device/${b.deviceId}?tab=money`}>
                                    View transactions →
                                </Link>
                            </div>
                        ))}
                </div>
            )}

            <div className="stats-row" style={{ marginTop: '1.25rem' }}>
                <div className="stat-card stat-online">
                    <div className="stat-value">{formatINR(totals.credit)}</div>
                    <div className="stat-label">Credited ({totals.nCredit})</div>
                </div>
                <div className="stat-card stat-offline">
                    <div className="stat-value">{formatINR(totals.debit)}</div>
                    <div className="stat-label">Debited ({totals.nDebit})</div>
                </div>
                <div className="stat-card stat-money">
                    <div className="stat-value">{formatINR(totals.net)}</div>
                    <div className="stat-label">Net flow</div>
                </div>
            </div>

            <div className="toolbar">
                <div className="search-wrap">
                    <span className="search-icon">🔍</span>
                    <input
                        className="form-input search-input"
                        placeholder="Search money SMS — bank, UPI ref, amount…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                        <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">✕</button>
                    )}
                </div>
                <div className="toolbar-filters">
                    <select
                        className="form-input sort-select"
                        value={deviceFilter}
                        onChange={(e) => {
                            setDeviceFilter(e.target.value);
                            setParams(e.target.value === 'all' ? {} : { device: e.target.value });
                        }}
                        aria-label="Filter by device"
                    >
                        <option value="all">All devices</option>
                        {devices.map((d) => (
                            <option key={d.id} value={d.id}>
                                #{numberMap.get(d.id) ?? '?'} {d.name}
                            </option>
                        ))}
                    </select>
                    <div className="segmented">
                        {([
                            ['all', 'All'],
                            ['credit', '↑ Credit'],
                            ['debit', '↓ Debit'],
                            ['balance', 'Bal'],
                        ] as [KindFilter, string][]).map(([v, label]) => (
                            <button key={v} className={`segmented-btn ${kind === v ? 'active' : ''}`} onClick={() => setKind(v)}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="glass-card">
                {filtered.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem' }}>
                        <div className="empty-state-icon">💰</div>
                        <h2>No money messages</h2>
                        <p>No credit / debit / balance SMS match the current filters.</p>
                    </div>
                ) : (
                    <div className="data-list">
                        {filtered.slice(0, 300).map((t) => (
                            <div key={t.key} className="data-item">
                                <div className={`data-item-icon ${t.kind === 'credit' ? 'incoming' : t.kind === 'debit' ? 'missed' : ''}`}>
                                    {t.kind === 'credit' ? '💵' : t.kind === 'debit' ? '💸' : '🏦'}
                                </div>
                                <div className="data-item-content">
                                    <div className="data-item-header">
                                        <span className="data-item-title">{t.sender}</span>
                                        <span className="data-item-time">{new Date(t.timestamp).toLocaleString()}</span>
                                    </div>
                                    <div className="data-item-body">{t.message}</div>
                                    <div className="data-item-meta">
                                        <span className={`badge ${t.kind === 'credit' ? 'badge-success' : t.kind === 'debit' ? 'badge-danger' : 'badge-warning'}`}>
                                            {t.kind}
                                            {t.amount !== null ? ` · ${formatINR(t.amount)}` : ''}
                                        </span>
                                        {t.balance !== null && (
                                            <span className="badge">Bal {formatINR(t.balance)}</span>
                                        )}
                                        <Link className="link-chip" to={`/device/${t.deviceId}`}>
                                            #{numberMap.get(t.deviceId) ?? '?'} {t.deviceName}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
