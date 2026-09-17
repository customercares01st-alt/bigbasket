import { Device, SimInfo, SMS } from '../types';

// ─── Transaction / money-message detection ───────────────────────────────────
// Tuned for Indian bank / UPI SMS patterns (SBI, HDFC, ICICI, Axis, YONO, etc.)

export type TransactionKind = 'credit' | 'debit' | 'balance' | 'other';

export interface ParsedTransaction {
    kind: TransactionKind;
    amounts: number[];
    /** First / primary amount (usually the txn amount). */
    amount: number | null;
    /** Balance figure mentioned in the message, if any. */
    balance: number | null;
    currency: string;
}

const CREDIT_RE =
    /\b(credit(?:ed)?|cr\b|received|deposited|deposited|refund(?:ed)?|cashback|neft\s*cr|imps\s*cr|upi\s*cr)\b/i;
const DEBIT_RE =
    /\b(debit(?:ed)?|dr\b|deducted|withdrawn|spent|paid|purchase|transferred|sent|neft\s*dr|imps\s*dr|upi\s*dr|charged|auto[-\s]?debit|emi\b)\b/i;
const BALANCE_RE =
    /\b(bal(?:ance)?|avl\s*bal|available\s+balance|closing\s+bal|total\s+bal|opbal|clbal)\b/i;
const MONEY_HINT_RE =
    /\b(inr|rs\.?|rupees?|₹|upi|neft|imps|rtgs|nach|pos|atm|cif|a\/c|ac\/|account|txn|transaction)\b/i;

// Matches: Rs 1,234.56 | Rs.1234 | INR 1234.50 | ₹1,234 | 1234.56 INR
const AMOUNT_RE =
    /(?:(?:rs\.?|inr|₹)\s*([\d,]+\.\d{1,2}|[\d,]+)|([\d,]+\.\d{1,2}|[\d,]+)\s*(?:rs\.?|inr|₹))/gi;

// Matches the balance figure specifically:
// "available balance ... Rs 12,345.67", "Bal: Rs.123", "Avl Bal INR 500"
const BALANCE_AMOUNT_RE =
    /(?:avl\.?\s*bal(?:ance)?|available\s+bal(?:ance)?|(?:closing|total|current|updated|new|remaining|account)\s+bal(?:ance)?|bal(?:ance)?|opbal|clbal)\s*(?:is|:|of|-|–)?\s*(?:rs\.?|inr|₹)?\s*([\d,]+\.\d{1,2}|[\d,]+)/i;

function parseNumber(raw: string): number | null {
    const n = parseFloat(raw.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
}

export function parseTransaction(message: string): ParsedTransaction {
    const amounts: number[] = [];
    AMOUNT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = AMOUNT_RE.exec(message)) !== null) {
        const n = parseNumber(m[1] ?? m[2] ?? '');
        if (n !== null) amounts.push(n);
    }

    let balance: number | null = null;
    const b = message.match(BALANCE_AMOUNT_RE);
    if (b) balance = parseNumber(b[1]);

    const hasCredit = CREDIT_RE.test(message);
    const hasDebit = DEBIT_RE.test(message);
    const hasBalance = BALANCE_RE.test(message);

    let kind: TransactionKind = 'other';
    if (hasCredit && !hasDebit) kind = 'credit';
    else if (hasDebit && !hasCredit) kind = 'debit';
    else if (hasBalance) kind = 'balance';

    return {
        kind,
        amounts,
        amount: amounts.length > 0 ? amounts[0] : null,
        balance,
        currency: '₹',
    };
}

export function isTransactionMessage(message: string): boolean {
    if (!MONEY_HINT_RE.test(message)) return false;
    AMOUNT_RE.lastIndex = 0;
    if (!AMOUNT_RE.test(message)) return false;
    return (
        CREDIT_RE.test(message) ||
        DEBIT_RE.test(message) ||
        BALANCE_RE.test(message) ||
        /\b(credited|debited|deposited|withdrawn|transferred|upi|neft|imps)\b/i.test(message)
    );
}

export function getTransactionKind(message: string): TransactionKind {
    if (!isTransactionMessage(message)) return 'other';
    return parseTransaction(message).kind;
}

export function formatINR(n: number | null | undefined): string {
    if (n === null || n === undefined || !Number.isFinite(n)) return '—';
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Balance tracking ────────────────────────────────────────────────────────

export interface BalanceInfo {
    balance: number;
    timestamp: string;
    sender: string;
    deviceId: string;
    deviceName: string;
    snippet: string;
}

/** Latest balance figure found in a message list (newest message wins). */
export function getLatestBalance(
    messages: SMS[],
    deviceId = '',
    deviceName = '',
): BalanceInfo | null {
    const sorted = [...messages].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    for (const sms of sorted) {
        const parsed = parseTransaction(sms.message);
        if (parsed.balance !== null) {
            return {
                balance: parsed.balance,
                timestamp: sms.timestamp,
                sender: sms.type === 'incoming' ? sms.sender : sms.receiver,
                deviceId,
                deviceName,
                snippet: sms.message.slice(0, 160),
            };
        }
    }
    return null;
}

// ─── Device helpers: stable numbering, sorting, SIM labelling ────────────────

export type DeviceSortKey = 'newest' | 'oldest' | 'name' | 'status';
export type DeviceStatusFilter = 'all' | 'online' | 'offline';

/**
 * Stable device numbering: oldest-known device gets #1.
 * Uses lastSeen as a proxy for first connection order (oldest lastSeen first),
 * falling back to id so numbering is deterministic across reloads.
 */
export function getDeviceNumberMap(devices: Device[]): Map<string, number> {
    const ordered = [...devices].sort((a, b) => {
        const t = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
        if (t !== 0) return t;
        return a.id.localeCompare(b.id);
    });
    const map = new Map<string, number>();
    ordered.forEach((d, i) => map.set(d.id, i + 1));
    return map;
}

export function sortDevices(devices: Device[], sort: DeviceSortKey): Device[] {
    const list = [...devices];
    switch (sort) {
        case 'newest':
            return list.sort(
                (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
            );
        case 'oldest':
            return list.sort(
                (a, b) => new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime(),
            );
        case 'name':
            return list.sort((a, b) =>
                (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }),
            );
        case 'status':
            return list.sort((a, b) => {
                if (a.status === b.status)
                    return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
                return a.status === 'online' ? -1 : 1;
            });
        default:
            return list;
    }
}

export function filterDevices(
    devices: Device[],
    query: string,
    status: DeviceStatusFilter,
): Device[] {
    const q = query.trim().toLowerCase();
    return devices.filter((d) => {
        if (status !== 'all' && d.status !== status) return false;
        if (!q) return true;
        const sims = (d.simCards || [])
            .map((s) => `${s.carrierName} ${s.displayName} ${s.phoneNumber}`)
            .join(' ');
        return (
            d.name.toLowerCase().includes(q) ||
            (d.phoneNumber || '').toLowerCase().includes(q) ||
            d.id.toLowerCase().includes(q) ||
            sims.toLowerCase().includes(q)
        );
    });
}

/** Human label for which SIM a message belongs to (when the app reports it). */
export function getSimLabelForSms(sms: SMS, simCards: SimInfo[] = []): string | null {
    const subId = sms.subscriptionId;
    const slot = sms.slotIndex ?? sms.simSlot;
    if (subId !== undefined && subId > 0 && simCards.length > 0) {
        const sim = simCards.find((s) => s.subscriptionId === subId);
        if (sim) return sim.displayName || `SIM ${(sim.slotIndex ?? 0) + 1}`;
    }
    if (slot !== undefined && slot >= 0 && simCards.length > 0) {
        const sim = simCards.find((s) => s.slotIndex === slot);
        if (sim) return sim.displayName || `SIM ${slot + 1}`;
        return `SIM ${slot + 1}`;
    }
    if (subId !== undefined && subId > 0) return `SIM ${subId}`;
    if (slot !== undefined && slot >= 0) return `SIM ${slot + 1}`;
    return null;
}

/** Summary label for a device's SIM state: "No SIM", "Single SIM", "Dual SIM". */
export function getSimSummary(simCards: SimInfo[] = []): {
    label: string;
    count: number;
    carriers: string;
} {
    const count = simCards.length;
    const carriers = simCards
        .map((s) => s.carrierName)
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(' · ');
    if (count === 0) return { label: 'No SIM', count, carriers: '' };
    if (count === 1) return { label: 'Single SIM', count, carriers };
    return { label: `${count} SIMs`, count, carriers };
}
