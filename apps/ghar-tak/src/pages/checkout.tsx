import { useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import {
  CreateOrderRequestPaymentMethod,
  useCreateAddress,
  useCreateOrder,
  useDeleteAddress,
  useListAddresses,
  useUpdateAddress,
  useValidateCoupon,
  type Address,
} from '@workspace/api-client-react';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Banknote,
  Check,
  CreditCard,
  Loader2,
  LogIn,
  MapPin,
  Package,
  Pencil,
  Plus,
  ShoppingBag,
  Smartphone,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DELIVERY_FEE = 50;
const FREE_DELIVERY_THRESHOLD = 1500;

const PAYMENT_OPTIONS = [
  { value: CreateOrderRequestPaymentMethod.cash_on_delivery, label: 'Cash on Delivery', hint: 'Pay when your order arrives', icon: Banknote },
  { value: CreateOrderRequestPaymentMethod.jazzcash, label: 'JazzCash', hint: 'Mobile wallet transfer', icon: Smartphone },
  { value: CreateOrderRequestPaymentMethod.easypaisa, label: 'EasyPaisa', hint: 'Mobile wallet transfer', icon: Smartphone },
  { value: CreateOrderRequestPaymentMethod.card, label: 'Card', hint: 'Debit or credit card', icon: CreditCard },
];

type AddressDraft = {
  label: string;
  line1: string;
  city: string;
  phone: string;
  instructions: string;
  isDefault: boolean;
};

const EMPTY_ADDRESS: AddressDraft = {
  label: 'Home',
  line1: '',
  city: '',
  phone: '',
  instructions: '',
  isDefault: false,
};

export default function CheckoutPage() {
  const { user, isLoaded } = useUser();
  const { items, providerId, providerName, totalPrice, clearCart } = useCart();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const subtotal = totalPrice;
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;

  const { data: addresses, isLoading: addressesLoading } = useListAddresses({
    query: { enabled: !!user, queryKey: ['listAddresses'] },
  });
  const addressList: Address[] = Array.isArray(addresses) ? addresses : [];

  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>(CreateOrderRequestPaymentMethod.cash_on_delivery);
  const [notes, setNotes] = useState('');
  const [couponInput, setCouponInput] = useState('');
  // `subtotal` is the cart total the discount was worked out for.
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; description?: string | null; subtotal: number } | null>(null);
  const recheckingCoupon = useRef(false);
  // The code the customer currently wants; an answer for any other code (for example,
  // one they removed while it was being checked) is ignored.
  const activeCouponCode = useRef<string | null>(null);

  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(EMPTY_ADDRESS);

  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const deleteAddress = useDeleteAddress();

  const validateCoupon = useValidateCoupon({
    mutation: {
      onSuccess: (result, variables) => {
        const recheck = recheckingCoupon.current;
        recheckingCoupon.current = false;
        if (variables.data.code !== activeCouponCode.current) return;
        if (result.valid && result.code && typeof result.discount === 'number') {
          activeCouponCode.current = result.code;
          setAppliedCoupon({
            code: result.code,
            discount: result.discount,
            description: result.description,
            subtotal: variables.data.subtotal,
          });
          setCouponInput(result.code);
          if (!recheck) {
            toast({ title: 'Coupon applied', description: result.description ?? `You saved PKR ${result.discount.toFixed(0)}` });
          }
        } else {
          activeCouponCode.current = null;
          setAppliedCoupon(null);
          toast({
            title: recheck ? 'Coupon removed' : 'Coupon not applied',
            description: result.reason ?? 'This code is not valid for your cart.',
            variant: 'destructive',
          });
        }
      },
      onError: (_error, variables) => {
        const recheck = recheckingCoupon.current;
        recheckingCoupon.current = false;
        if (variables.data.code !== activeCouponCode.current) return;
        if (recheck) {
          // Drop the coupon rather than show a discount we couldn't confirm for the new cart.
          activeCouponCode.current = null;
          setAppliedCoupon(null);
          toast({ title: 'Coupon removed', description: 'Your cart changed. Please apply the code again.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Coupon check failed', description: 'Please try again in a moment.', variant: 'destructive' });
      },
    },
  });

  const createOrder = useCreateOrder({
    mutation: {
      onSuccess: (order) => {
        clearCart();
        queryClient.invalidateQueries({ queryKey: ['listMyOrders'] });
        toast({ title: 'Order placed', description: `Order #${order.id.slice(0, 8)} has been placed with ${order.providerName}.` });
        navigate(`/orders/${order.id}`);
      },
      onError: (error) => {
        const message = (error as { data?: { error?: string } } | null)?.data?.error;
        toast({ title: 'Could not place order', description: message ?? 'Please try again.', variant: 'destructive' });
      },
    },
  });

  // The discount depends on the cart total, so check the coupon again whenever the cart changes.
  useEffect(() => {
    if (!appliedCoupon || appliedCoupon.subtotal === subtotal || validateCoupon.isPending) return;
    if (subtotal <= 0) {
      activeCouponCode.current = null;
      setAppliedCoupon(null);
      return;
    }
    recheckingCoupon.current = true;
    validateCoupon.mutate({ data: { code: appliedCoupon.code, subtotal } });
  }, [appliedCoupon, subtotal, validateCoupon.isPending]);

  useEffect(() => {
    if (selectedAddressId || addressList.length === 0) return;
    setSelectedAddressId(addressList[0].id);
  }, [addressList, selectedAddressId]);

  const selectedAddress = addressList.find((address) => address.id === selectedAddressId) ?? null;
  const discount = appliedCoupon?.discount ?? 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  const addressSummary = useMemo(() => {
    if (!selectedAddress) return '';
    return [selectedAddress.line1, selectedAddress.city].filter(Boolean).join(', ');
  }, [selectedAddress]);

  function openNewAddressDialog() {
    setEditingAddressId(null);
    setAddressDraft(EMPTY_ADDRESS);
    setAddressDialogOpen(true);
  }

  function openEditAddressDialog(address: Address) {
    setEditingAddressId(address.id);
    setAddressDraft({
      label: address.label,
      line1: address.line1,
      city: address.city,
      phone: address.phone ?? '',
      instructions: address.instructions ?? '',
      isDefault: address.isDefault,
    });
    setAddressDialogOpen(true);
  }

  function handleSaveAddress() {
    if (!addressDraft.line1.trim() || !addressDraft.city.trim()) {
      toast({ title: 'Missing details', description: 'Street address and city are required.', variant: 'destructive' });
      return;
    }

    const payload = {
      label: addressDraft.label.trim() || 'Home',
      line1: addressDraft.line1.trim(),
      city: addressDraft.city.trim(),
      phone: addressDraft.phone.trim() || undefined,
      instructions: addressDraft.instructions.trim() || undefined,
      isDefault: addressDraft.isDefault,
    };

    if (editingAddressId) {
      updateAddress.mutate(
        { addressId: editingAddressId, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['listAddresses'] });
            setAddressDialogOpen(false);
            toast({ title: 'Address updated' });
          },
          onError: () => toast({ title: 'Could not update address', variant: 'destructive' }),
        }
      );
    } else {
      createAddress.mutate(
        { data: payload },
        {
          onSuccess: (address) => {
            queryClient.invalidateQueries({ queryKey: ['listAddresses'] });
            setSelectedAddressId(address.id);
            setAddressDialogOpen(false);
            toast({ title: 'Address saved' });
          },
          onError: () => toast({ title: 'Could not save address', variant: 'destructive' }),
        }
      );
    }
  }

  function handleDeleteAddress(addressId: string) {
    deleteAddress.mutate(
      { addressId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['listAddresses'] });
          if (selectedAddressId === addressId) setSelectedAddressId('');
          toast({ title: 'Address removed' });
        },
        onError: () => toast({ title: 'Could not remove address', variant: 'destructive' }),
      }
    );
  }

  function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code || subtotal <= 0) return;
    activeCouponCode.current = code;
    validateCoupon.mutate({ data: { code, subtotal } });
  }

  function handleRemoveCoupon() {
    activeCouponCode.current = null;
    setAppliedCoupon(null);
    setCouponInput('');
  }

  function handlePlaceOrder() {
    if (!providerId || items.length === 0) return;
    if (!selectedAddress) {
      toast({ title: 'Add a delivery address', description: 'Choose or add an address before placing your order.', variant: 'destructive' });
      return;
    }

    createOrder.mutate({
      data: {
        providerId,
        paymentMethod: paymentMethod as (typeof CreateOrderRequestPaymentMethod)[keyof typeof CreateOrderRequestPaymentMethod],
        addressId: selectedAddress.id,
        deliveryAddress: addressSummary,
        notes: notes.trim() || undefined,
        deliveryFee,
        couponCode: appliedCoupon?.code,
        items: items.map((item) => ({
          productId: item.product.id,
          serviceId: null,
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
        })),
      },
    });
  }

  if (!isLoaded) {
    return <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <LogIn className="h-16 w-16 text-primary mb-6" />
        <h1 className="text-2xl font-bold font-headline mb-3">Sign in to check out</h1>
        <p className="text-muted-foreground mb-6 max-w-md">Your cart is saved. Sign in to add a delivery address and place your order.</p>
        <Button asChild><Link href="/sign-in">Sign In</Link></Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/50 mb-6" />
        <h1 className="text-2xl font-bold font-headline mb-3">Your cart is empty</h1>
        <p className="text-muted-foreground mb-6 max-w-md">Browse nearby stores and add a few essentials to check out.</p>
        <div className="flex gap-3">
          <Button asChild><Link href="/stores">Shop Stores</Link></Button>
          <Button variant="outline" asChild><Link href="/">Back Home</Link></Button>
        </div>
      </div>
    );
  }

  const isSavingAddress = createAddress.isPending || updateAddress.isPending;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ShoppingBag className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold font-headline">Checkout</h1>
          {providerName && <p className="text-sm text-muted-foreground">Ordering from {providerName}</p>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5 text-primary" /> Delivery Address</CardTitle>
              <Button variant="outline" size="sm" onClick={openNewAddressDialog}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {addressesLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : addressList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="mb-3">No saved addresses yet.</p>
                  <Button variant="outline" size="sm" onClick={openNewAddressDialog}>
                    <Plus className="mr-1 h-4 w-4" /> Add your first address
                  </Button>
                </div>
              ) : (
                <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId} className="gap-3">
                  {addressList.map((address) => (
                    <label
                      key={address.id}
                      htmlFor={`address-${address.id}`}
                      className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/40 data-[state=checked]:border-primary"
                      data-state={selectedAddressId === address.id ? 'checked' : 'unchecked'}
                    >
                      <RadioGroupItem value={address.id} id={`address-${address.id}`} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{address.label}</span>
                          {address.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{address.line1}, {address.city}</p>
                        {address.phone && <p className="text-xs text-muted-foreground">Phone: {address.phone}</p>}
                        {address.instructions && <p className="text-xs text-muted-foreground italic">{address.instructions}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(event) => { event.preventDefault(); openEditAddressDialog(address); }}
                          aria-label={`Edit ${address.label}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(event) => { event.preventDefault(); handleDeleteAddress(address.id); }}
                          aria-label={`Delete ${address.label}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="h-5 w-5 text-primary" /> Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid gap-3 sm:grid-cols-2">
                {PAYMENT_OPTIONS.map(({ value, label, hint, icon: Icon }) => (
                  <label
                    key={value}
                    htmlFor={`payment-${value}`}
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/40 data-[state=checked]:border-primary"
                    data-state={paymentMethod === value ? 'checked' : 'unchecked'}
                  >
                    <RadioGroupItem value={value} id={`payment-${value}`} className="mt-1" />
                    <div>
                      <div className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4 text-primary" /> {label}</div>
                      <p className="text-xs text-muted-foreground">{hint}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Package className="h-5 w-5 text-primary" /> Order Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="order-notes" className="sr-only">Notes for the store</Label>
              <Textarea
                id="order-notes"
                placeholder="Delivery instructions, gate code, substitutions…"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="resize-none"
              />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-start gap-3">
                  <img
                    src={product.imageUrl || `https://placehold.co/48x48.png?text=${encodeURIComponent(product.name[0])}`}
                    alt={product.name}
                    className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{product.name}</p>
                    <p className="text-xs text-muted-foreground">Qty {quantity}</p>
                  </div>
                  <span className="text-sm font-medium">PKR {(product.price * quantity).toFixed(0)}</span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Tag className="h-4 w-4 text-primary" />
                    <span className="font-medium">{appliedCoupon.code}</span>
                    <span className="text-muted-foreground">− PKR {appliedCoupon.discount.toFixed(0)}</span>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={handleRemoveCoupon} aria-label="Remove coupon">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Coupon code"
                    value={couponInput}
                    onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleApplyCoupon(); } }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleApplyCoupon}
                    disabled={!couponInput.trim() || validateCoupon.isPending}
                  >
                    {validateCoupon.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Try WELCOME10 on orders over PKR 500.</p>
            </div>

            <Separator />

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>PKR {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery fee</span>
                <span>{deliveryFee === 0 ? <span className="text-green-600">Free</span> : `PKR ${deliveryFee.toFixed(2)}`}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Coupon discount</span>
                  <span>− PKR {discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold border-t pt-2">
                <span>Total</span>
                <span className="text-primary">PKR {total.toFixed(2)}</span>
              </div>
            </div>

            {subtotal < FREE_DELIVERY_THRESHOLD && (
              <p className="text-xs text-muted-foreground">
                Add PKR {Math.ceil(FREE_DELIVERY_THRESHOLD - subtotal)} more for free delivery.
              </p>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handlePlaceOrder}
              disabled={createOrder.isPending || !selectedAddress}
            >
              {createOrder.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Placing order…</>
              ) : (
                <><Check className="mr-2 h-4 w-4" /> Place Order · PKR {total.toFixed(0)}</>
              )}
            </Button>
            {!selectedAddress && (
              <p className="text-xs text-destructive text-center">Add a delivery address to place your order.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAddressId ? 'Edit address' : 'Add a delivery address'}</DialogTitle>
            <DialogDescription>Where should we deliver this order?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="address-label">Label</Label>
                <Input
                  id="address-label"
                  placeholder="Home, Office…"
                  value={addressDraft.label}
                  onChange={(event) => setAddressDraft({ ...addressDraft, label: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address-city">City</Label>
                <Input
                  id="address-city"
                  placeholder="Lahore"
                  value={addressDraft.city}
                  onChange={(event) => setAddressDraft({ ...addressDraft, city: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-line1">Street address</Label>
              <Input
                id="address-line1"
                placeholder="House 12, Street 4, Gulberg III"
                value={addressDraft.line1}
                onChange={(event) => setAddressDraft({ ...addressDraft, line1: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-phone">Phone (optional)</Label>
              <Input
                id="address-phone"
                placeholder="03xx xxxxxxx"
                value={addressDraft.phone}
                onChange={(event) => setAddressDraft({ ...addressDraft, phone: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-instructions">Delivery instructions (optional)</Label>
              <Textarea
                id="address-instructions"
                placeholder="Ring the bell twice, leave with guard…"
                value={addressDraft.instructions}
                onChange={(event) => setAddressDraft({ ...addressDraft, instructions: event.target.value })}
                rows={2}
                className="resize-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={addressDraft.isDefault}
                onChange={(event) => setAddressDraft({ ...addressDraft, isDefault: event.target.checked })}
              />
              Make this my default address
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAddress} disabled={isSavingAddress}>
              {isSavingAddress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingAddressId ? 'Save Changes' : 'Save Address'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
