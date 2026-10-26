'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Printer, LogOut, FileText, Clock, CheckCircle, CreditCard, Package, User, History, BarChart3, ChevronRight, Send, QrCode, Loader2, AlertCircle, PartyPopper, X } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { ToastProvider, useToast } from '@/components/Toast';

interface UserProfile {
  id: string; name: string; mobile: string; role: string;
  department?: string; section?: string; rollNumber?: string;
}

interface OrderData {
  id: string; orderNumber: string; pageCount: number; pricePerPage: number;
  totalAmount: number; appliedTierLabel: string; status: string;
  pdfSubmitted: boolean; createdAt: string;
  payment?: { paymentStatus: string; amount: number; paymentReference?: string };
}

interface PricingResult {
  tierId: string; tierLabel: string; pricePerPage: number; totalAmount: number; pageCount: number;
}

interface Stats {
  totalOrders: number; totalPages: number; totalSpent: number;
}

function DashboardContent() {
  const router = useRouter();
  const { addToast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'order' | 'orders' | 'profile' | 'stats'>('order');

  // Order creation state
  const [pageCount, setPageCount] = useState('');
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [orderStep, setOrderStep] = useState<'pages' | 'pdf' | 'payment' | 'confirmed' | 'tracking'>('pages');
  const [currentOrder, setCurrentOrder] = useState<OrderData | null>(null);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [activeQr, setActiveQr] = useState<any>(null);
  const [paymentRef, setPaymentRef] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);

  // Orders list
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  // Queue info
  const [queuePosition, setQueuePosition] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);

  // Socket for real-time
  const { on, isConnected } = useSocket(user?.id, 'STUDENT');

  // Fetch user session
  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(data => {
        if (!data.authenticated) { router.push('/student/login'); return; }
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => router.push('/student/login'));
  }, [router]);

  // Fetch shop settings and QR
  useEffect(() => {
    fetch('/api/shop/settings').then(r => r.json()).then(d => setShopSettings(d.settings));
    fetch('/api/shop/qr').then(r => r.json()).then(d => setActiveQr(d.activeQr));
  }, []);

  // Fetch orders
  const fetchOrders = useCallback(() => {
    fetch('/api/orders').then(r => r.json()).then(d => setOrders(d.orders || []));
  }, []);

  const fetchStats = useCallback(() => {
    fetch('/api/orders/stats').then(r => r.json()).then(d => setStats(d.stats));
  }, []);

  useEffect(() => { fetchOrders(); fetchStats(); }, [fetchOrders, fetchStats]);

  // Socket.IO real-time listeners
  useEffect(() => {
    if (!user) return;

    const unsub1 = on('order:statusChanged', (data: any) => {
      if (data.userId === user.id) {
        if (data.status === 'READY_FOR_COLLECTION') {
          addToast({ type: 'success', title: '🎉 Your Print is Ready!', message: `Order ${data.orderNumber} is ready for collection.` });
        } else if (data.status === 'PRINTING') {
          addToast({ type: 'info', title: '🖨️ Printing Started', message: `Order ${data.orderNumber} is now being printed.` });
        }
        // Refresh current order
        if (currentOrder && currentOrder.id === data.orderId) {
          fetch(`/api/orders/${data.orderId}`).then(r => r.json()).then(d => {
            setCurrentOrder(d.order);
            setQueuePosition(d.queuePosition);
            setEstimatedTime(d.estimatedTime);
          });
        }
        fetchOrders();
      }
    });

    const unsub2 = on('queue:updated', (data: any) => {
      if (currentOrder) {
        const pos = data.orderPositions?.find((p: any) => p.orderId === currentOrder.id);
        if (pos) {
          setQueuePosition(pos.position);
          setEstimatedTime(pos.estimatedTime);
        }
      }
    });

    const unsub3 = on('notification', (data: any) => {
      if (data.userId === user.id) {
        addToast({ type: data.type || 'info', title: data.title, message: data.message });
      }
    });

    const unsub4 = on('payment:verified', (data: any) => {
      if (data.userId === user.id) {
        addToast({ type: 'success', title: '✅ Payment Verified', message: `Payment for ${data.orderNumber} verified.` });
        if (currentOrder && currentOrder.id === data.orderId) {
          fetch(`/api/orders/${data.orderId}`).then(r => r.json()).then(d => {
            setCurrentOrder(d.order);
            setQueuePosition(d.queuePosition);
            setEstimatedTime(d.estimatedTime);
            setOrderStep('tracking');
          });
        }
        fetchOrders();
      }
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [user, currentOrder, on, addToast, fetchOrders]);

  // Calculate price when page count changes
  const handlePageCountChange = async (value: string) => {
    setPageCount(value);
    const pages = parseInt(value);
    if (!pages || pages < 1) { setPricing(null); return; }
    setPricingLoading(true);
    try {
      const res = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageCount: pages }),
      });
      const data = await res.json();
      if (res.ok) { setPricing(data.pricing); }
      else { setPricing(null); }
    } catch { setPricing(null); }
    setPricingLoading(false);
  };

  // Create order
  const handleCreateOrder = async () => {
    if (!pricing) return;
    setOrderLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageCount: parseInt(pageCount) }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentOrder(data.order);
        setOrderStep('pdf');
        addToast({ type: 'success', title: 'Order Created', message: `Order ${data.order.orderNumber} created successfully!` });
        fetchOrders();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to create order' });
    }
    setOrderLoading(false);
  };

  // Mark PDF sent
  const handlePdfSent = async () => {
    if (!currentOrder) return;
    try {
      await fetch(`/api/orders/${currentOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfSubmitted: true, status: 'PDF_SENT' }),
      });
      setCurrentOrder({ ...currentOrder, pdfSubmitted: true, status: 'PDF_SENT' });
      setOrderStep('payment');
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to update order' });
    }
  };

  // Mark payment done
  const handlePaymentDone = async () => {
    if (!currentOrder) return;
    setOrderLoading(true);
    try {
      // First update order status to PAYMENT_PENDING if needed
      await fetch(`/api/orders/${currentOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAYMENT_PENDING' }),
      });

      // Submit payment
      const res = await fetch('/api/payments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: currentOrder.id, paymentReference: paymentRef }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrderStep('confirmed');
        // Fetch updated order with queue position
        const orderRes = await fetch(`/api/orders/${currentOrder.id}`);
        const orderData = await orderRes.json();
        setCurrentOrder(orderData.order);
        setQueuePosition(orderData.queuePosition);
        setEstimatedTime(orderData.estimatedTime);
        addToast({ type: 'success', title: 'Payment Submitted', message: 'Waiting for shop verification.' });
        fetchOrders();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Payment submission failed' });
    }
    setOrderLoading(false);
  };

  // Logout
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/student/login');
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-500/20 text-gray-300',
    PDF_SENT: 'bg-blue-500/20 text-blue-300',
    PAYMENT_PENDING: 'bg-amber-500/20 text-amber-300',
    PAYMENT_SUBMITTED: 'bg-orange-500/20 text-orange-300',
    PAYMENT_VERIFIED: 'bg-emerald-500/20 text-emerald-300',
    CONFIRMED: 'bg-purple-500/20 text-purple-300',
    WAITING: 'bg-yellow-500/20 text-yellow-300',
    PRINTING: 'bg-blue-500/20 text-blue-300',
    READY_FOR_COLLECTION: 'bg-green-500/20 text-green-300',
    COLLECTED: 'bg-gray-500/20 text-gray-300',
    CANCELLED: 'bg-red-500/20 text-red-300',
  };

  const statusLabels: Record<string, string> = {
    DRAFT: 'Draft', PDF_SENT: 'PDF Sent', PAYMENT_PENDING: 'Payment Pending',
    PAYMENT_SUBMITTED: 'Payment Submitted', PAYMENT_VERIFIED: 'Payment Verified',
    CONFIRMED: 'Confirmed', WAITING: 'In Queue', PRINTING: 'Printing',
    READY_FOR_COLLECTION: 'Ready for Collection', COLLECTED: 'Collected', CANCELLED: 'Cancelled',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
        <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-40 px-4 py-3 border-b border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Qprint</h1>
              <p className="text-[10px] text-[var(--color-text-muted)]">Student Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} title={isConnected ? 'Connected' : 'Disconnected'} />
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Welcome */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Welcome, {user?.name}! 👋</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{user?.department} • Section {user?.section} • Roll No: {user?.rollNumber}</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'order' as const, label: 'New Order', icon: <Package className="w-4 h-4" /> },
            { id: 'orders' as const, label: 'My Orders', icon: <History className="w-4 h-4" /> },
            { id: 'stats' as const, label: 'Spending', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'profile' as const, label: 'Profile', icon: <User className="w-4 h-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-purple-500/20'
                  : 'bg-[var(--color-surface-card)] text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* NEW ORDER TAB */}
        {activeTab === 'order' && (
          <div className="space-y-6">
            {/* Step: Enter Pages */}
            {orderStep === 'pages' && (
              <div className="glass rounded-2xl p-6 animate-fade-up">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[var(--color-primary)]" /> New Print Order
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[var(--color-text-muted)] mb-2">Enter Number of Pages</label>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={pageCount}
                      onChange={(e) => handlePageCountChange(e.target.value)}
                      placeholder="e.g., 75"
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-4 text-2xl font-bold text-white text-center placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
                    />
                  </div>

                  {pricingLoading && (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-[var(--color-primary)] animate-spin" /></div>
                  )}

                  {pricing && (
                    <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[var(--color-text-muted)]">Pages</span>
                        <span className="font-semibold text-white">{pricing.pageCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[var(--color-text-muted)]">Pricing Tier</span>
                        <span className="text-sm text-[var(--color-primary-light)]">{pricing.tierLabel}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[var(--color-text-muted)]">Price Per Page</span>
                        <span className="font-semibold text-white">₹{pricing.pricePerPage}</span>
                      </div>
                      <div className="border-t border-[var(--color-border)] pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-base font-semibold text-white">Total Amount</span>
                          <span className="text-2xl font-bold gradient-text">₹{pricing.totalAmount}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleCreateOrder}
                    disabled={!pricing || orderLoading}
                    className="w-full py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {orderLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                    {orderLoading ? 'Creating Order...' : 'Continue'}
                  </button>
                </div>
              </div>
            )}

            {/* Step: Send PDF */}
            {orderStep === 'pdf' && currentOrder && (
              <div className="glass rounded-2xl p-6 animate-fade-up">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-400" /> Send Your PDF
                </h3>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4">
                  <p className="text-sm text-blue-300 mb-2">Send your PDF and payment screenshot to the Xerox shop:</p>
                  {shopSettings && (
                    <a
                      href={`tel:${shopSettings.contactNumber}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
                    >
                      📞 Call: {shopSettings.contactNumber}
                    </a>
                  )}
                </div>
                <div className="flex items-center justify-between p-4 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] mb-4">
                  <div>
                    <p className="text-sm text-[var(--color-text-muted)]">Order</p>
                    <p className="font-bold text-white">{currentOrder.orderNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[var(--color-text-muted)]">Amount</p>
                    <p className="font-bold text-[var(--color-accent)]">₹{currentOrder.totalAmount}</p>
                  </div>
                </div>
                <button
                  onClick={handlePdfSent}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" /> PDF Sent
                </button>
                <button
                  onClick={() => setOrderStep('payment')}
                  className="w-full mt-2 py-3 text-[var(--color-text-muted)] text-sm hover:text-white transition-colors"
                >
                  Skip to payment →
                </button>
              </div>
            )}

            {/* Step: Payment */}
            {orderStep === 'payment' && currentOrder && (
              <div className="glass rounded-2xl p-6 animate-fade-up">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" /> Make Payment
                </h3>

                <div className="text-center mb-6">
                  <p className="text-sm text-[var(--color-text-muted)] mb-2">Amount to Pay</p>
                  <p className="text-4xl font-black gradient-text">₹{currentOrder.totalAmount}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{currentOrder.pageCount} pages × ₹{currentOrder.pricePerPage}/page</p>
                </div>

                {activeQr ? (
                  <div className="bg-white rounded-xl p-4 mb-4 flex justify-center">
                    <img
                      src={`/api/uploads${activeQr.fileReference.replace('/uploads', '')}`}
                      alt="Payment QR Code"
                      className="max-w-[200px] max-h-[200px] object-contain"
                    />
                  </div>
                ) : (
                  <div className="bg-[var(--color-surface)] rounded-xl p-6 mb-4 text-center border border-[var(--color-border)]">
                    <QrCode className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--color-text-muted)]">Payment QR not yet uploaded by the shop</p>
                    {shopSettings?.upiId && (
                      <p className="text-sm text-[var(--color-primary-light)] mt-2">UPI ID: {shopSettings.upiId}</p>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="Payment Reference / Transaction ID (optional)"
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-white text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-all"
                  />
                  <button
                    onClick={handlePaymentDone}
                    disabled={orderLoading}
                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {orderLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                    {orderLoading ? 'Submitting...' : 'Payment Done'}
                  </button>
                </div>
              </div>
            )}

            {/* Step: Confirmed / Tracking */}
            {(orderStep === 'confirmed' || orderStep === 'tracking') && currentOrder && (
              <div className="space-y-4 animate-fade-up">
                {/* Order Confirmed Card */}
                {currentOrder.status === 'READY_FOR_COLLECTION' ? (
                  <div className="glass rounded-2xl p-6 text-center border-2 border-green-500/30">
                    <PartyPopper className="w-16 h-16 text-green-400 mx-auto mb-4 animate-bounce" />
                    <h3 className="text-2xl font-bold text-green-400 mb-2">YOUR PRINT IS READY!</h3>
                    <p className="text-[var(--color-text-muted)]">Order {currentOrder.orderNumber} is ready for collection.</p>
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-6 text-center">
                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-white mb-1">
                      {currentOrder.payment?.paymentStatus === 'PAYMENT_SUBMITTED' ? 'Payment Submitted' : 'Order Confirmed'}
                    </h3>
                    <p className="text-2xl font-black gradient-text mt-2">{currentOrder.orderNumber}</p>
                  </div>
                )}

                {/* Queue Position */}
                {queuePosition > 0 && (
                  <div className="glass rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--color-text-muted)]">Orders Before You</p>
                      <p className="text-3xl font-bold text-white">{queuePosition - 1}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[var(--color-text-muted)]">Approx. Collection Time</p>
                      <p className="text-xl font-bold text-[var(--color-accent)]">~{estimatedTime} min</p>
                    </div>
                  </div>
                )}

                {/* Status Timeline */}
                <div className="glass rounded-2xl p-6">
                  <h4 className="text-sm font-semibold text-[var(--color-text-muted)] mb-4">Order Progress</h4>
                  <div className="space-y-3">
                    {[
                      { key: 'PAYMENT_SUBMITTED', label: 'Payment Submitted', icon: '💳' },
                      { key: 'PAYMENT_VERIFIED', label: 'Payment Verified', icon: '✅' },
                      { key: 'WAITING', label: 'In Queue', icon: '⏳' },
                      { key: 'PRINTING', label: 'Printing', icon: '🖨️' },
                      { key: 'READY_FOR_COLLECTION', label: 'Ready for Collection', icon: '🎉' },
                    ].map((step, i) => {
                      const orderStatuses = ['PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED', 'CONFIRMED', 'WAITING', 'PRINTING', 'READY_FOR_COLLECTION', 'COLLECTED'];
                      const currentIndex = orderStatuses.indexOf(currentOrder.status);
                      const stepIndex = orderStatuses.indexOf(step.key);
                      const isActive = stepIndex <= currentIndex;
                      const isCurrent = step.key === currentOrder.status;

                      return (
                        <div key={step.key} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                            isCurrent ? 'bg-[var(--color-primary)] animate-pulse-glow' :
                            isActive ? 'bg-emerald-500' : 'bg-[var(--color-surface)]'
                          }`}>
                            {step.icon}
                          </div>
                          <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-[var(--color-text-muted)]'}`}>
                            {step.label}
                          </span>
                          {isCurrent && (
                            <span className="ml-auto px-2 py-0.5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary-light)] text-xs">Current</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-center text-xs text-[var(--color-text-muted)]">
                  ⚡ Updates in real-time — no need to refresh
                </p>

                <button
                  onClick={() => { setOrderStep('pages'); setCurrentOrder(null); setPageCount(''); setPricing(null); setPaymentRef(''); }}
                  className="w-full py-3 bg-[var(--color-surface-card)] text-white rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all text-sm"
                >
                  + New Order
                </button>
              </div>
            )}
          </div>
        )}

        {/* MY ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-3 animate-fade-up">
            <h3 className="text-lg font-semibold text-white mb-4">My Orders</h3>
            {orders.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <Package className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
                <p className="text-[var(--color-text-muted)]">No orders yet</p>
              </div>
            ) : (
              orders.map(order => (
                <div key={order.id} className="glass rounded-xl p-4 border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-all cursor-pointer"
                  onClick={() => { setCurrentOrder(order); setOrderStep('tracking'); setActiveTab('order'); fetch(`/api/orders/${order.id}`).then(r => r.json()).then(d => { setQueuePosition(d.queuePosition); setEstimatedTime(d.estimatedTime); }); }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-semibold text-[var(--color-primary-light)]">{order.orderNumber}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                      {statusLabels[order.status]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-muted)]">{order.pageCount} pages • ₹{order.pricePerPage}/pg</span>
                    <span className="font-semibold text-white">₹{order.totalAmount}</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* SPENDING TAB */}
        {activeTab === 'stats' && (
          <div className="space-y-4 animate-fade-up">
            <h3 className="text-lg font-semibold text-white mb-4">Spending Summary</h3>
            {stats ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="glass rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Total Orders</p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-white">{stats.totalPages}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Pages Printed</p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold gradient-text">₹{stats.totalSpent}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Total Spent</p>
                </div>
              </div>
            ) : (
              <div className="glass rounded-2xl p-8 text-center">
                <BarChart3 className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
                <p className="text-[var(--color-text-muted)]">No spending data yet</p>
              </div>
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && user && (
          <div className="glass rounded-2xl p-6 animate-fade-up">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-[var(--color-primary)]" /> My Profile
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Name', value: user.name },
                { label: 'Mobile', value: user.mobile },
                { label: 'Department', value: user.department || '-' },
                { label: 'Section', value: user.section || '-' },
                { label: 'Roll Number', value: user.rollNumber || '-' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-[var(--color-border)] last:border-0">
                  <span className="text-sm text-[var(--color-text-muted)]">{item.label}</span>
                  <span className="text-sm font-medium text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function StudentDashboard() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}
