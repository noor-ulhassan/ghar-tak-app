import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useUser } from '@clerk/react';
import {
  useCreateReview,
  useGetOrder,
  useListProviderProducts,
  useUpdateOrderStatus,
  getGetOrderQueryKey,
  type Order,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCart } from '@/context/CartContext';
import type { CartItem } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Package,
  RotateCcw,
  Star,
  Store,
  Truck,
  XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiErrorReason } from '@/lib/api-error';

const TIMELINE_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<string, string> = {
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  shipped: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  processing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-muted text-muted-foreground',
};

const STEP_ICONS = [Clock, Check, Package, Truck, CheckCircle2];

export default function OrderTrackingPage({ params }: { params: { id: string } }) {
  const { user, isLoaded } = useUser();
  const orderId = params.id;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { addItems, openCart } = useCart();

  const { data: order, isLoading, isError } = useGetOrder(orderId, {
    query: {
      enabled: !!orderId && !!user,
      queryKey: getGetOrderQueryKey(orderId),
      // Follow the store's progress without a reload; stop once the order is finished.
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === 'delivered' || status === 'cancelled' ? false : 15000;
      },
    },
  });

  const { data: catalog } = useListProviderProducts(order?.providerId ?? '', undefined, {
    query: { enabled: !!order?.providerId, queryKey: ['listProviderProducts', order?.providerId ?? ''] },
  });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const updateStatus = useUpdateOrderStatus({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetOrderQueryKey(orderId), updated);
        queryClient.invalidateQueries({ queryKey: ['listMyOrders'] });
        setCancelOpen(false);
        toast({ title: 'Order cancelled', description: 'The store has been notified.' });
      },
      onError: (err) => {
        // A 409 means the store already moved the order on (for example, shipped it).
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
        toast({ title: 'Could not cancel order', description: apiErrorReason(err) ?? 'Please try again.', variant: 'destructive' });
      },
    },
  });

  const createReview = useCreateReview({
    mutation: {
      onSuccess: () => {
        setRateOpen(false);
        setComment('');
        toast({ title: 'Thanks for the review', description: 'Your rating helps other shoppers.' });
      },
      onError: (err) => toast({ title: 'Could not submit review', description: apiErrorReason(err), variant: 'destructive' }),
    },
  });

  const timeline = useMemo(() => {
    if (!order) return [];
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const byStatus = new Map(history.map((event) => [event.status, event.at]));
    if (!byStatus.has(order.status)) byStatus.set(order.status, order.updatedAt ?? order.createdAt);
    return TIMELINE_STEPS.map((step, index) => ({
      step,
      at: byStatus.get(step) ?? null,
      icon: STEP_ICONS[index],
    }));
  }, [order]);

  function handleReorder(currentOrder: Order) {
    const products = Array.isArray(catalog) ? catalog : [];
    const items: CartItem[] = [];
    let unavailable = 0;

    for (const orderItem of currentOrder.items) {
      const match =
        products.find((product) => product.id === orderItem.productId) ??
        products.find((product) => product.name === orderItem.name);
      if (match) {
        items.push({ product: match, quantity: orderItem.quantity });
      } else {
        unavailable += 1;
      }
    }

    if (items.length === 0) {
      toast({ title: 'Items no longer available', description: 'This store has changed its catalogue.', variant: 'destructive' });
      return;
    }

    const result = addItems(items, currentOrder.providerId, currentOrder.providerName);
    if (result === 'confirm') return; // the cart asks before replacing another store's items

    const notes = [
      unavailable > 0 ? `${unavailable} item${unavailable > 1 ? 's' : ''} no longer available were skipped.` : '',
      result === 'limit' ? 'Some quantities were lowered to what the store has in stock.' : '',
    ].filter(Boolean);
    openCart();
    toast({ title: 'Items added to cart', description: notes.join(' ') || undefined });
  }

  // Wait for sign-in to load before deciding the customer is signed out.
  if (!isLoaded) {
    return <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <Package className="h-16 w-16 text-primary mb-6" />
        <h1 className="text-2xl font-bold font-headline mb-3">Sign in to view this order</h1>
        <Button asChild><Link href="/sign-in">Sign In</Link></Button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (isError || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
        <h1 className="text-2xl font-bold font-headline mb-3">Order not found</h1>
        <p className="text-muted-foreground mb-6">We couldn't load this order. It may belong to another account.</p>
        <Button asChild><Link href="/profile">Back to Profile</Link></Button>
      </div>
    );
  }

  const isCancelled = order.status === 'cancelled';
  const canCancel = !isCancelled && order.status !== 'delivered' && order.status !== 'shipped';
  const canRate = order.status === 'delivered';
  const currentStepIndex = TIMELINE_STEPS.indexOf(order.status as (typeof TIMELINE_STEPS)[number]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} aria-label="Back to profile">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-headline">Order #{order.id.slice(0, 8)}</h1>
            <p className="text-sm text-muted-foreground">
              Placed {new Date(order.createdAt).toLocaleString()} · {order.providerName}
            </p>
          </div>
        </div>
        <Badge className={STATUS_STYLES[order.status] ?? ''}>{STATUS_LABEL[order.status] ?? order.status}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px] items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {isCancelled ? (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Order cancelled</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.updatedAt ?? order.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <ol className="relative space-y-5">
                  {timeline.map(({ step, at, icon: Icon }, index) => {
                    const done = at !== null && index <= currentStepIndex;
                    const active = index === currentStepIndex;
                    return (
                      <li key={step} className="flex items-start gap-4">
                        <div className="relative flex flex-col items-center">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                              done
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/30 bg-background text-muted-foreground'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          {index < timeline.length - 1 && (
                            <span className={`w-0.5 flex-1 min-h-[20px] ${done ? 'bg-primary/60' : 'bg-muted'}`} />
                          )}
                        </div>
                        <div className="pb-1">
                          <p className={`font-medium ${active ? 'text-primary' : ''}`}>{STATUS_LABEL[step]}</p>
                          <p className="text-xs text-muted-foreground">
                            {at ? new Date(at).toLocaleString() : 'Pending'}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Store className="h-5 w-5 text-primary" /> Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-muted-foreground">Qty {item.quantity} · PKR {item.unitPrice.toFixed(2)} each</p>
                  </div>
                  <span className="font-medium">PKR {(item.unitPrice * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>PKR {(order.total - order.deliveryFee + order.discount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery fee</span>
                <span>{order.deliveryFee === 0 ? 'Free' : `PKR ${order.deliveryFee.toFixed(2)}`}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
                  <span>− PKR {order.discount.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="text-primary">PKR {order.total.toFixed(2)}</span>
              </div>
              <div className="pt-2 text-xs text-muted-foreground capitalize">
                Payment: {order.paymentMethod.replace(/_/g, ' ')}
              </div>
              {order.deliveryAddress && (
                <div className="flex items-start gap-1.5 pt-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{order.deliveryAddress}</span>
                </div>
              )}
              {order.notes && (
                <p className="text-xs text-muted-foreground italic pt-1">Notes: {order.notes}</p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={() => handleReorder(order)}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reorder
            </Button>
            {canRate && (
              <Button className="w-full" onClick={() => setRateOpen(true)}>
                <Star className="mr-2 h-4 w-4" /> Rate this order
              </Button>
            )}
            {canCancel && (
              <Button variant="destructive" className="w-full" onClick={() => setCancelOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" /> Cancel order
              </Button>
            )}
            <Button variant="ghost" className="w-full" asChild>
              <Link href={`/stores/${order.providerId}`}>Visit store</Link>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              The store will be notified and any payment will be refunded as per its policy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep Order</Button>
            <Button
              variant="destructive"
              onClick={() => updateStatus.mutate({ orderId, data: { status: 'cancelled' } })}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate {order.providerName}</DialogTitle>
            <DialogDescription>How was your experience with this order?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className="p-1"
                  aria-label={`${value} star${value > 1 ? 's' : ''}`}
                >
                  <Star className={`h-8 w-8 ${value <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="review-comment">Comment (optional)</Label>
              <Textarea
                id="review-comment"
                placeholder="Fresh items, quick delivery…"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createReview.mutate({ providerId: order.providerId, data: { rating, comment: comment.trim() || undefined } })}
              disabled={createReview.isPending}
            >
              {createReview.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
