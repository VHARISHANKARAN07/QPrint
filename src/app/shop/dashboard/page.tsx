'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Printer, LogOut, FileText, Clock, CheckCircle, CreditCard,
  Package, User, History, BarChart3, ChevronRight, Send, QrCode,
  Loader2, AlertCircle, RefreshCw, Star, Search, Filter, Eye,
  Settings, ShieldAlert, ArrowUpRight, DollarSign, Layers,
  Calendar, Download, Check, AlertTriangle, ExternalLink, X, Plus
} from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { ToastProvider, useToast } from '@/components/Toast';

interface ShopUser {
  id: string;
  name: string;
  username: string;
  role: string;
}

interface OrderData {
  id: string;
  orderNumber: string;
  pageCount: number;
  pricePerPage: number;
  totalAmount: number;
  appliedTierLabel: string;
  status: string;
  userRole: 'STUDENT' | 'TEACHER';
  pdfSubmitted: boolean;
  pdfUrl?: string | null;
  manualPriority: boolean;
  createdAt: string;
  printingStartedAt?: string | null;
  completedAt?: string | null;
  collectedAt?: string | null;
  user: {
    id: string;
    name: string;
    mobile: string;
    department?: string;
    section?: string;
    rollNumber?: string;
    role: string;
  };
  payment?: {
    id: string;
    paymentStatus: string;
    amount: number;
    paymentReference?: string;
    paymentTimestamp?: string;
    verifiedAt?: string;
  };
  pricingTier?: {
    minimumPages: number;
    maximumPages?: number | null;
    pricePerPage: number;
  };
}

interface AnalyticsData {
  today: {
    totalOrders: number;
    totalPages: number;
    totalEarnings: number;
    pendingOrders: number;
    printingOrders: number;
    readyForCollection: number;
  };
  month: {
    totalOrders: number;
    totalPages: number;
    totalEarnings: number;
  };
  activeQueue: number;
}

interface PricingTier {
  id: string;
  minimumPages: number;
  maximumPages?: number | null;
  pricePerPage: number;
  active: boolean;
}

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
  actor: {
    name: string;
    role: string;
    mobile?: string;
  };
}

function ShopDashboardContent() {
  const router = useRouter();
  const { addToast } = useToast();

  const [shopUser, setShopUser] = useState<ShopUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'queue' | 'payments' | 'analytics' | 'qr' | 'pricing' | 'settings' | 'audit'>('queue');

  // Orders and Queue
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [filterRole, setFilterRole] = useState<'ALL' | 'STUDENT' | 'TEACHER'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [paymentsHistory, setPaymentsHistory] = useState<any[]>([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  // QR Code
  const [activeQr, setActiveQr] = useState<any>(null);
  const [qrHistory, setQrHistory] = useState<any[]>([]);
  const [uploadingQr, setUploadingQr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings
  const [shopSettings, setShopSettings] = useState<any>({
    shopName: 'RIT Xerox Shop',
    contactNumber: '9876543210',
    upiId: 'ritxerox@upi',
    estimatedProcessingTime: 5,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Pricing Tiers
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [showAddTierModal, setShowAddTierModal] = useState(false);
  const [newTierMin, setNewTierMin] = useState('');
  const [newTierMax, setNewTierMax] = useState('');
  const [newTierPrice, setNewTierPrice] = useState('');
  const [addingTier, setAddingTier] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Real-time socket
  const { on, isConnected } = useSocket(shopUser?.id, 'SHOP_HANDLER');

  // Check auth session
  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated || data.user.role !== 'SHOP_HANDLER') {
          router.push('/shop/login');
          return;
        }
        setShopUser(data.user);
        setLoading(false);
      })
      .catch(() => router.push('/shop/login'));
  }, [router]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRole !== 'ALL') params.set('role', filterRole);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', '100');

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();
      if (data.orders) setOrders(data.orders);
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  }, [filterRole, filterStatus, searchQuery]);

  // Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/shop/analytics');
      const data = await res.json();
      if (data.today) setAnalytics(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch settings & QR
  const fetchSettingsAndQr = useCallback(async () => {
    try {
      const [setRes, qrRes] = await Promise.all([
        fetch('/api/shop/settings'),
        fetch('/api/shop/qr'),
      ]);
      const setData = await setRes.json();
      const qrData = await qrRes.json();

      if (setData.settings) setShopSettings(setData.settings);
      if (qrData.activeQr !== undefined) {
        setActiveQr(qrData.activeQr);
        setQrHistory(qrData.history || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch pricing tiers
  const fetchPricing = useCallback(async () => {
    try {
      const res = await fetch('/api/pricing');
      const data = await res.json();
      if (data.tiers) setPricingTiers(data.tiers);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch('/api/shop/audit?limit=50');
      const data = await res.json();
      if (data.logs) setAuditLogs(data.logs);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  // Fetch payment history
  const fetchPaymentHistory = useCallback(async () => {
    setPaymentHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (historyDateFrom) params.set('dateFrom', historyDateFrom);
      if (historyDateTo) params.set('dateTo', historyDateTo);
      const res = await fetch(`/api/payments/history?${params.toString()}`);
      const data = await res.json();
      if (data.payments) setPaymentsHistory(data.payments);
    } catch (err) {
      console.error(err);
    } finally {
      setPaymentHistoryLoading(false);
    }
  }, [historyDateFrom, historyDateTo]);

  // Initial load
  useEffect(() => {
    if (shopUser) {
      fetchOrders();
      fetchAnalytics();
      fetchSettingsAndQr();
      fetchPricing();
    }
  }, [shopUser, fetchOrders, fetchAnalytics, fetchSettingsAndQr, fetchPricing]);

  // Tab switch loads
  useEffect(() => {
    if (!shopUser) return;
    if (activeTab === 'analytics') fetchPaymentHistory();
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'pricing') fetchPricing();
  }, [activeTab, shopUser, fetchPaymentHistory, fetchAuditLogs, fetchPricing]);

  // Socket.IO Real-time listeners
  useEffect(() => {
    if (!shopUser) return;

    const unsubOrderCreated = on('order:created', (data: any) => {
      addToast({
        type: 'info',
        title: '🔔 New Order Received!',
        message: `Order #${data.orderNumber} for ${data.pageCount} pages (₹${data.totalAmount}) placed.`,
      });
      fetchOrders();
      fetchAnalytics();
    });

    const unsubPaymentSubmitted = on('payment:submitted', (data: any) => {
      addToast({
        type: 'warning',
        title: '💳 Payment Submitted for Verification',
        message: `Order #${data.orderNumber} submitted UTR: ${data.paymentReference || 'N/A'}. Ready to verify.`,
      });
      fetchOrders();
    });

    const unsubStatusChanged = on('order:statusChanged', (data: any) => {
      fetchOrders();
      fetchAnalytics();
    });

    const unsubQueueUpdated = on('queue:updated', () => {
      fetchOrders();
    });

    return () => {
      unsubOrderCreated();
      unsubPaymentSubmitted();
      unsubStatusChanged();
      unsubQueueUpdated();
    };
  }, [shopUser, on, addToast, fetchOrders, fetchAnalytics]);

  // Actions: Update order status
  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        addToast({
          type: 'success',
          title: 'Status Updated',
          message: `Order moved to ${status.replace(/_/g, ' ')}`,
        });
        fetchOrders();
        fetchAnalytics();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(data.order);
        }
      } else {
        addToast({ type: 'error', title: 'Update Failed', message: data.error || 'Failed to update order status' });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Network Error', message: 'Could not connect to server' });
    }
  };

  // Actions: Toggle manual priority
  const togglePriority = async (orderId: string, currentPriority: boolean) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualPriority: !currentPriority }),
      });
      const data = await res.json();
      if (data.success) {
        addToast({
          type: 'info',
          title: !currentPriority ? '⭐ Priority Set' : 'Normal Priority Restored',
          message: !currentPriority ? 'Order moved to front of queue.' : 'Order queue position normalized.',
        });
        fetchOrders();
      } else {
        addToast({ type: 'error', title: 'Failed', message: data.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to toggle priority' });
    }
  };

  // Actions: Verify payment
  const verifyPayment = async (orderId: string) => {
    try {
      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.success) {
        addToast({
          type: 'success',
          title: '✅ Payment Verified!',
          message: 'Payment marked verified and order moved to WAITING queue.',
        });
        fetchOrders();
        fetchAnalytics();
      } else {
        addToast({ type: 'error', title: 'Verification Failed', message: data.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Network Error', message: 'Failed to verify payment' });
    }
  };

  // Actions: Upload QR Code
  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('qrImage', file);

    setUploadingQr(true);
    try {
      const res = await fetch('/api/shop/qr', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        addToast({
          type: 'success',
          title: 'QR Code Updated',
          message: 'New shop QR code is active and visible to all users.',
        });
        fetchSettingsAndQr();
      } else {
        addToast({ type: 'error', title: 'Upload Failed', message: data.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to upload QR code' });
    } finally {
      setUploadingQr(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Actions: Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/shop/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shopSettings),
      });
      const data = await res.json();
      if (data.success) {
        addToast({ type: 'success', title: 'Settings Saved', message: 'Shop details updated successfully.' });
      } else {
        addToast({ type: 'error', title: 'Save Failed', message: data.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to save settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  // Actions: Add Pricing Tier
  const handleAddTier = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingTier(true);
    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minimumPages: parseInt(newTierMin),
          maximumPages: newTierMax ? parseInt(newTierMax) : null,
          pricePerPage: parseFloat(newTierPrice),
        }),
      });
      const data = await res.json();
      if (data.success) {
        addToast({ type: 'success', title: 'Tier Added', message: 'New pricing tier created.' });
        setShowAddTierModal(false);
        setNewTierMin('');
        setNewTierMax('');
        setNewTierPrice('');
        fetchPricing();
      } else {
        addToast({ type: 'error', title: 'Failed', message: data.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to add pricing tier' });
    } finally {
      setAddingTier(false);
    }
  };

  // Actions: Logout
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/shop/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  // Pending payments awaiting shop verification
  const pendingPayments = orders.filter(
    (o) => o.payment?.paymentStatus === 'PAYMENT_SUBMITTED' || o.status === 'PAYMENT_SUBMITTED'
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Printer className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">Qprint</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase tracking-wider">
                  Shop Handler
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">By HEMALESH • Real-Time Xerox Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Socket Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium">
              <span className="relative flex h-2.5 w-2.5">
                {isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <span className={isConnected ? 'text-emerald-400' : 'text-amber-400'}>
                {isConnected ? 'Real-Time Connected' : 'Connecting...'}
              </span>
            </div>

            {/* User Profile & Logout */}
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <div className="text-right hidden md:block">
                <div className="text-xs font-semibold text-white">{shopUser?.name}</div>
                <div className="text-[11px] text-slate-400">@{shopUser?.username}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/10 hover:text-rose-400 text-slate-300 transition-colors border border-slate-700/60"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 py-6 space-y-6">
        {/* Quick Stat Highlights */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Queue</p>
                <h3 className="text-2xl font-bold text-white mt-1">{analytics.activeQueue}</h3>
                <p className="text-[11px] text-emerald-400 mt-0.5 font-medium">
                  {analytics.today.printingOrders} currently printing
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pending Verify</p>
                <h3 className="text-2xl font-bold text-amber-400 mt-1">{pendingPayments.length}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Awaiting payment check</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Today's Revenue</p>
                <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                  ₹{analytics.today.totalEarnings.toFixed(2)}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{analytics.today.totalPages} pages today</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ready for Pickup</p>
                <h3 className="text-2xl font-bold text-cyan-400 mt-1">
                  {analytics.today.readyForCollection}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Awaiting customer</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Package className="w-6 h-6" />
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-800/80 scrollbar-none">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === 'queue'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Live Queue & Orders</span>
            <span
              className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'queue' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === 'payments'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Payment Verification</span>
            {pendingPayments.length > 0 && (
              <span className="text-xs px-1.5 py-0.2 rounded-full font-bold bg-amber-400 text-slate-950 animate-pulse">
                {pendingPayments.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics & History</span>
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === 'qr'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QR Management</span>
          </button>

          <button
            onClick={() => setActiveTab('pricing')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === 'pricing'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Pricing Tiers</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Shop Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Audit Trail</span>
          </button>
        </div>

        {/* TAB 1: LIVE QUEUE & ORDERS */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            {/* Filter & Search Toolbar */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Role Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setFilterRole('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filterRole === 'ALL' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Orders
                </button>
                <button
                  onClick={() => setFilterRole('STUDENT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filterRole === 'STUDENT'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Students
                </button>
                <button
                  onClick={() => setFilterRole('TEACHER')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filterRole === 'TEACHER'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Teachers
                </button>
              </div>

              {/* Status dropdown & Search */}
              <div className="flex flex-1 md:max-w-xl gap-2 items-center">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="WAITING">Waiting in Queue</option>
                  <option value="PRINTING">Currently Printing</option>
                  <option value="READY_FOR_COLLECTION">Ready for Collection</option>
                  <option value="COLLECTED">Collected</option>
                  <option value="PAYMENT_SUBMITTED">Payment Submitted</option>
                  <option value="PAYMENT_PENDING">Payment Pending</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Order #, Name, Mobile..."
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={fetchOrders}
                  disabled={ordersLoading}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Refresh list"
                >
                  <RefreshCw className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Orders List / Cards */}
            {ordersLoading && orders.length === 0 ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                <p className="text-sm">Loading queue and orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-400 space-y-2">
                <Printer className="w-10 h-10 mx-auto text-slate-600" />
                <h4 className="text-base font-semibold text-white">No orders found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Orders submitted by students or teachers will appear in real time here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order, idx) => {
                  const isWaiting = order.status === 'WAITING';
                  const isPrinting = order.status === 'PRINTING';
                  const isReady = order.status === 'READY_FOR_COLLECTION';
                  const isCollected = order.status === 'COLLECTED';
                  const isSubmitted = order.status === 'PAYMENT_SUBMITTED';

                  return (
                    <div
                      key={order.id}
                      className={`bg-slate-900/60 border rounded-2xl p-4 transition-all hover:border-slate-700/80 ${
                        order.manualPriority
                          ? 'border-amber-500/50 bg-amber-500/[0.02] shadow-lg shadow-amber-500/5'
                          : isPrinting
                          ? 'border-emerald-500/50 bg-emerald-500/[0.02]'
                          : 'border-slate-800/80'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Left: Sequence, Role, Order Number, User Details */}
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                              order.manualPriority
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : isPrinting
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            #{idx + 1}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-base text-white">
                                {order.orderNumber}
                              </span>

                              <span
                                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                  order.userRole === 'TEACHER'
                                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                }`}
                              >
                                {order.userRole}
                              </span>

                              {order.manualPriority && (
                                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  <Star className="w-3 h-3 fill-amber-300" />
                                  PRIORITY (PRINT NEXT)
                                </span>
                              )}

                              {/* Status Badge */}
                              <span
                                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                                  isPrinting
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse'
                                    : isReady
                                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                    : isWaiting
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                    : isCollected
                                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                                    : isSubmitted
                                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                {order.status.replace(/_/g, ' ')}
                              </span>
                            </div>

                            {/* Customer information */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                              <span className="font-medium text-slate-300">{order.user.name}</span>
                              <span>📞 {order.user.mobile}</span>
                              {order.user.department && (
                                <span>Dept: {order.user.department}</span>
                              )}
                              {order.user.rollNumber && (
                                <span>Roll: {order.user.rollNumber}</span>
                              )}
                              <span>
                                Placed: {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Middle: Pages & Pricing summary */}
                        <div className="flex items-center gap-6 self-start lg:self-center bg-slate-950/40 px-4 py-2 rounded-xl border border-slate-800/60">
                          <div>
                            <p className="text-[10px] uppercase font-medium text-slate-500">Pages</p>
                            <p className="text-sm font-bold text-white">{order.pageCount} pgs</p>
                            <p className="text-[10px] text-slate-400">{order.appliedTierLabel}</p>
                          </div>
                          <div className="h-8 w-px bg-slate-800" />
                          <div>
                            <p className="text-[10px] uppercase font-medium text-slate-500">Total Price</p>
                            <p className="text-sm font-bold text-emerald-400">₹{order.totalAmount.toFixed(2)}</p>
                            <p className="text-[10px] text-slate-400">
                              {order.payment?.paymentStatus === 'PAYMENT_VERIFIED' ? (
                                <span className="text-emerald-400 font-medium">✓ Paid</span>
                              ) : order.payment?.paymentStatus === 'PAYMENT_SUBMITTED' ? (
                                <span className="text-amber-400 font-medium">⏳ Verifying</span>
                              ) : (
                                <span className="text-rose-400 font-medium">Unpaid</span>
                              )}
                            </p>
                          </div>
                          {order.pdfUrl && (
                            <>
                              <div className="h-8 w-px bg-slate-800" />
                              <a
                                href={order.pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>PDF</span>
                              </a>
                            </>
                          )}
                        </div>

                        {/* Right: Handler Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Priority Toggle button */}
                          {(isWaiting || isPrinting) && (
                            <button
                              onClick={() => togglePriority(order.id, order.manualPriority)}
                              className={`p-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                order.manualPriority
                                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                                  : 'bg-slate-800/80 hover:bg-slate-800 text-amber-400 border-slate-700/80'
                              }`}
                              title={order.manualPriority ? 'Remove high priority' : 'Set as high priority (Print Next)'}
                            >
                              <Star className={`w-4 h-4 ${order.manualPriority ? 'fill-slate-950' : ''}`} />
                              <span className="hidden sm:inline">
                                {order.manualPriority ? 'High Priority' : 'Prioritize'}
                              </span>
                            </button>
                          )}

                          {/* Status progression buttons */}
                          {isSubmitted && (
                            <button
                              onClick={() => verifyPayment(order.id)}
                              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Verify & Queue</span>
                            </button>
                          )}

                          {isWaiting && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'PRINTING')}
                              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                            >
                              <Printer className="w-4 h-4" />
                              <span>Start Printing</span>
                            </button>
                          )}

                          {isPrinting && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'READY_FOR_COLLECTION')}
                              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 flex items-center gap-1.5"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Mark Ready for Pickup</span>
                            </button>
                          )}

                          {isReady && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'COLLECTED')}
                              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                              <Package className="w-4 h-4" />
                              <span>Mark Collected</span>
                            </button>
                          )}

                          {/* Order Details modal button */}
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
                            title="Inspect details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PAYMENT VERIFICATION */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                <span>Pending Payment Verification Queue</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Students and teachers submit UPI reference numbers / UTR IDs. Verify the payment in your UPI app and click "Verify & Queue" to move the order into the live printing queue.
              </p>
            </div>

            {pendingPayments.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-400 space-y-2">
                <CheckCircle className="w-10 h-10 mx-auto text-emerald-500" />
                <h4 className="text-base font-semibold text-white">All payments verified!</h4>
                <p className="text-xs text-slate-500">There are no pending payment approvals right now.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {pendingPayments.map((order) => (
                  <div
                    key={order.id}
                    className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-base">{order.orderNumber}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          NEEDS VERIFICATION
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {order.userRole}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 font-medium">
                        Customer: <span className="text-white font-bold">{order.user.name}</span> (📞 {order.user.mobile})
                      </div>

                      <div className="flex items-center gap-3 text-xs bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
                        <span className="text-slate-400">Payment Ref / UTR:</span>
                        <span className="font-mono font-bold text-amber-300">
                          {order.payment?.paymentReference || 'No reference entered'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end md:self-center">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Amount to verify</p>
                        <p className="text-xl font-bold text-emerald-400">₹{order.totalAmount.toFixed(2)}</p>
                        <p className="text-[11px] text-slate-400">{order.pageCount} pages</p>
                      </div>

                      <button
                        onClick={() => verifyPayment(order.id)}
                        className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Verify & Add to Queue</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ANALYTICS & PERMANENT HISTORY */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Financial Overview Cards */}
            {analytics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Earnings</p>
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-3xl font-extrabold text-white mt-2">
                    ₹{analytics.today.totalEarnings.toFixed(2)}
                  </h3>
                  <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-400">
                    <span>{analytics.today.totalOrders} Orders</span>
                    <span>{analytics.today.totalPages} Pages</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">This Month's Total</p>
                    <Calendar className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-3xl font-extrabold text-white mt-2">
                    ₹{analytics.month.totalEarnings.toFixed(2)}
                  </h3>
                  <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-400">
                    <span>{analytics.month.totalOrders} Orders</span>
                    <span>{analytics.month.totalPages} Pages</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estimated Queue Workload</p>
                    <Clock className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-3xl font-extrabold text-white mt-2">
                    {analytics.activeQueue * (shopSettings?.estimatedProcessingTime || 5)} mins
                  </h3>
                  <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-400">
                    <span>{analytics.activeQueue} active queue orders</span>
                    <span>~{shopSettings?.estimatedProcessingTime || 5}m / order</span>
                  </div>
                </div>
              </div>
            )}

            {/* Permanent Payment Ledger (Zero delete buttons) */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-emerald-400" />
                    <span>Permanent Payment Ledger</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Immutable transaction records. Every verified and submitted payment is permanently logged.
                  </p>
                </div>

                {/* Date range filter */}
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => setHistoryDateFrom(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-500 text-xs">to</span>
                  <input
                    type="date"
                    value={historyDateTo}
                    onChange={(e) => setHistoryDateTo(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={fetchPaymentHistory}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${paymentHistoryLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Ledger Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Date & Time</th>
                      <th className="py-3 px-4 font-semibold">Order Number</th>
                      <th className="py-3 px-4 font-semibold">Customer</th>
                      <th className="py-3 px-4 font-semibold">Reference / UTR</th>
                      <th className="py-3 px-4 font-semibold">Amount</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {paymentsHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No payment transactions recorded for selected period.
                        </td>
                      </tr>
                    ) : (
                      paymentsHistory.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                            {new Date(p.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-white">
                            {p.order?.orderNumber || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {p.order?.user?.name || 'Customer'}
                            <div className="text-[10px] text-slate-500">{p.order?.userRole}</div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400">
                            {p.paymentReference || '—'}
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-400">
                            ₹{Number(p.amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                p.paymentStatus === 'PAYMENT_VERIFIED'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {p.paymentStatus.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: QR CODE MANAGEMENT */}
        {activeTab === 'qr' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Current Active QR Display */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-400" />
                <span>Active Payment QR Code</span>
              </h3>
              <p className="text-xs text-slate-400">
                This QR code is shown to students and teachers at checkout for UPI payments.
              </p>

              <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center border border-slate-200">
                {activeQr ? (
                  <img
                    src={activeQr.fileReference}
                    alt="Active Shop QR"
                    className="w-48 h-48 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-48 h-48 bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                    <QrCode className="w-12 h-12 text-slate-300 mb-2" />
                    <span className="text-xs">No active QR uploaded yet</span>
                  </div>
                )}
                <div className="mt-3 text-center">
                  <p className="text-xs font-bold text-slate-800">{shopSettings?.upiId || 'ritxerox@upi'}</p>
                  <p className="text-[10px] text-slate-500">{shopSettings?.shopName}</p>
                </div>
              </div>

              {/* Upload New QR Button */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleQrUpload}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingQr}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  {uploadingQr ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading QR...</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Upload & Replace QR</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-500 text-center mt-2">
                  Uploading automatically deactivates previous QR and updates customer payment screens in real time.
                </p>
              </div>
            </div>

            {/* QR History Ledger */}
            <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-slate-400" />
                <span>QR Code History</span>
              </h3>
              <p className="text-xs text-slate-400">
                Audit record of all QR codes uploaded for this shop.
              </p>

              <div className="space-y-3">
                {qrHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No previous QR uploads recorded.</p>
                ) : (
                  qrHistory.map((qr) => (
                    <div
                      key={qr.id}
                      className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={qr.fileReference}
                          alt="QR Thumbnail"
                          className="w-12 h-12 rounded-lg object-contain bg-white p-1 border border-slate-700"
                        />
                        <div className="space-y-0.5">
                          <p className="text-xs font-mono text-slate-300">{qr.fileReference.split('/').pop()}</p>
                          <p className="text-[11px] text-slate-500">
                            Uploaded by {qr.uploader?.name || 'Shop Admin'} • {new Date(qr.uploadedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                          qr.active
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}
                      >
                        {qr.active ? 'Active' : 'Deactivated'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PRICING TIERS */}
        {activeTab === 'pricing' && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span>Configured Page Pricing Tiers</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Orders automatically calculate price based on page count matching these active tiers.
                </p>
              </div>

              <button
                onClick={() => setShowAddTierModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Pricing Tier</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {pricingTiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`bg-slate-900/60 border rounded-2xl p-5 space-y-3 ${
                    tier.active ? 'border-emerald-500/40' : 'border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Tier Range
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        tier.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tier.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="text-xl font-bold text-white">
                    {tier.minimumPages} {tier.maximumPages ? `- ${tier.maximumPages} pages` : '+ pages'}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Price per page:</span>
                    <span className="text-lg font-extrabold text-emerald-400">
                      ₹{Number(tier.pricePerPage).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: SHOP SETTINGS */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-400" />
                <span>Shop Profile & Operational Parameters</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure shop identification, UPI receiver, and queue time estimation settings.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Shop Display Name</label>
                <input
                  type="text"
                  value={shopSettings.shopName || ''}
                  onChange={(e) => setShopSettings({ ...shopSettings, shopName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Contact Phone Number</label>
                <input
                  type="text"
                  value={shopSettings.contactNumber || ''}
                  onChange={(e) => setShopSettings({ ...shopSettings, contactNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Receiving UPI ID</label>
                <input
                  type="text"
                  value={shopSettings.upiId || ''}
                  onChange={(e) => setShopSettings({ ...shopSettings, upiId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Estimated Processing Time per Order (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={shopSettings.estimatedProcessingTime || 5}
                  onChange={(e) =>
                    setShopSettings({ ...shopSettings, estimatedProcessingTime: parseInt(e.target.value) || 5 })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Used by the queue algorithm: Estimated Time = (Position in Queue × Mins per Order)
                </p>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Save Operational Settings</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 7: AUDIT LOG VIEWER */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-emerald-400" />
                  <span>Immutable System Audit Trail</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Security log recording status transitions, priority overrides, payment verifications, and config edits.
                </p>
              </div>
              <button
                onClick={fetchAuditLogs}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Refresh audit logs"
              >
                <RefreshCw className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                    <th className="py-2.5 px-3 font-semibold">Actor</th>
                    <th className="py-2.5 px-3 font-semibold">Action</th>
                    <th className="py-2.5 px-3 font-semibold">Entity Type</th>
                    <th className="py-2.5 px-3 font-semibold">Changes / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-slate-200 font-medium">
                          {log.actor?.name || 'System'}
                          <span className="text-[10px] text-slate-500 block">({log.actor?.role})</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-emerald-400">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{log.entityType}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300 max-w-xs truncate">
                          {log.newValue ? log.newValue : log.oldValue || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* INSPECT ORDER MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white font-mono">{selectedOrder.orderNumber}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400">
                  {selectedOrder.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Full Order Specification & History</p>
            </div>

            <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer Name:</span>
                <span className="font-bold text-white">{selectedOrder.user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Contact Mobile:</span>
                <span className="font-mono text-slate-200">{selectedOrder.user.mobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Role:</span>
                <span className="font-bold text-slate-200">{selectedOrder.userRole}</span>
              </div>
              {selectedOrder.user.department && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Department:</span>
                  <span className="text-slate-200">{selectedOrder.user.department}</span>
                </div>
              )}
              {selectedOrder.user.rollNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Roll Number:</span>
                  <span className="text-slate-200">{selectedOrder.user.rollNumber}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Page Count:</span>
                <span className="font-bold text-white">{selectedOrder.pageCount} pages</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tier Applied:</span>
                <span className="text-slate-200">{selectedOrder.appliedTierLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Price per Page:</span>
                <span className="text-slate-200">₹{selectedOrder.pricePerPage.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 font-bold">
                <span className="text-slate-300">Total Price:</span>
                <span className="text-emerald-400 text-sm">₹{selectedOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {selectedOrder.pdfUrl && (
              <a
                href={selectedOrder.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download / Preview Submitted PDF</span>
              </a>
            )}

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PRICING TIER MODAL */}
      {showAddTierModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowAddTierModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              <span>Create New Pricing Tier</span>
            </h3>

            <form onSubmit={handleAddTier} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Minimum Pages</label>
                <input
                  type="number"
                  min="1"
                  value={newTierMin}
                  onChange={(e) => setNewTierMin(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Maximum Pages (leave blank for unlimited)
                </label>
                <input
                  type="number"
                  min="1"
                  value={newTierMax}
                  onChange={(e) => setNewTierMax(e.target.value)}
                  placeholder="e.g. 10 (or empty for 101+)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Price per Page (₹)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  value={newTierPrice}
                  onChange={(e) => setNewTierPrice(e.target.value)}
                  placeholder="e.g. 2.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTierModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTier}
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
                >
                  {addingTier ? 'Saving...' : 'Add Tier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShopDashboardPage() {
  return (
    <ToastProvider>
      <ShopDashboardContent />
    </ToastProvider>
  );
}
