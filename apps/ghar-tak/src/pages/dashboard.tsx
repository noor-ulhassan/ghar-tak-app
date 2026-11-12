import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Briefcase, Building, BadgeCheck, CalendarClock, Edit3, Eye, ListChecks,
  Loader2, MessageSquare, Package, PlusCircle, ShoppingBag, ShoppingCart,
  Star, Trash2, TrendingUp, Users, DollarSign, ArrowUpRight, BarChart3,
  AlertCircle, MapPin,
} from "lucide-react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiErrorReason } from "@/lib/api-error";
import ConversationsList from "@/components/shared/ConversationsList";
import ShopLocationFields, { initialShopLocation, radiusProblem, shopLocationRequest } from "@/components/shared/ShopLocationFields";
import {
  useGetMyProvider, useGetMyProviderStats, useUpdateMyProvider,
  useListProviderProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useListProviderServices, useCreateService, useUpdateService, useDeleteService,
  useListProviderOrders, useUpdateOrderStatus,
  useListProviderReviews,
  useListProviderBookings, useUpdateBookingStatus,
  getListProviderBookingsQueryKey,
  useListConversations,
  getListConversationsQueryKey,
  useGetMySubscription,
  getGetMyProviderQueryKey,
  getGetMyProviderStatsQueryKey,
  getListProviderProductsQueryKey,
  getListProviderServicesQueryKey,
  getListProviderOrdersQueryKey,
  getListProviderReviewsQueryKey,
  getGetMySubscriptionQueryKey,
} from "@workspace/api-client-react";

// ─── helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending:    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    confirmed:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    processing: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    preparing:  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    shipped:    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    delivered:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    cancelled:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    active:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    trialing:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    past_due:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return map[status.toLowerCase()] ?? "bg-gray-100 text-gray-700";
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ))}
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function ProductsTab({ providerId }: { providerId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: products = [], isLoading } = useListProviderProducts(
    providerId,
    {},
    { query: { queryKey: getListProviderProductsQueryKey(providerId, {}) } },
  );

  const createMutation = useCreateProduct({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProviderProductsQueryKey(providerId, {}) });
        qc.invalidateQueries({ queryKey: getGetMyProviderStatsQueryKey() });
        toast({ title: "Product added" });
        setNew({ name: "", price: "", stock: "", description: "", category: "", sku: "" });
        setAddOpen(false);
      },
      onError: (err) => toast({ title: "Failed to add product", description: apiErrorReason(err), variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateProduct({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProviderProductsQueryKey(providerId, {}) });
        toast({ title: "Product updated" });
        setEditing(null);
      },
      onError: (err) => toast({ title: "Failed to update product", description: apiErrorReason(err), variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteProduct({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProviderProductsQueryKey(providerId, {}) });
        qc.invalidateQueries({ queryKey: getGetMyProviderStatsQueryKey() });
        toast({ title: "Product deleted" });
      },
      onError: (err) => toast({ title: "Failed to delete product", description: apiErrorReason(err), variant: "destructive" }),
    },
  });

  const [newP, setNew] = useState({ name: "", price: "", stock: "", description: "", category: "", sku: "" });
  const [editing, setEditing] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const handleAdd = () => {
    if (!newP.name || !newP.price) return;
    createMutation.mutate({
      providerId,
      data: {
        name: newP.name,
        price: Number(newP.price),
        stock: Number(newP.stock) || 0,
        description: newP.description || undefined,
        category: newP.category || "General",
        sku: newP.sku || undefined,
      } as any,
    });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold font-headline">Product Catalog</h3>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusCircle className="h-4 w-4 mr-2" />Add Product</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              <div><Label>Name</Label><Input value={newP.name} onChange={e => setNew({ ...newP, name: e.target.value })} placeholder="Product name" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Price (PKR)</Label><Input type="number" value={newP.price} onChange={e => setNew({ ...newP, price: e.target.value })} placeholder="200" /></div>
                <div><Label>Stock</Label><Input type="number" value={newP.stock} onChange={e => setNew({ ...newP, stock: e.target.value })} placeholder="50" /></div>
              </div>
              <div><Label>Category</Label><Input value={newP.category} onChange={e => setNew({ ...newP, category: e.target.value })} placeholder="Groceries" /></div>
              <div><Label>SKU</Label><Input value={newP.sku} onChange={e => setNew({ ...newP, sku: e.target.value })} placeholder="SKU-001" /></div>
              <div><Label>Description</Label><Textarea value={newP.description} onChange={e => setNew({ ...newP, description: e.target.value })} placeholder="Brief description" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Product
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <div className="h-32 bg-muted flex items-center justify-center">
              {product.imageUrl
                ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                : <Package className="h-12 w-12 text-muted-foreground/40" />}
            </div>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold">{product.name}</h4>
                  <p className="text-xs text-muted-foreground">{product.sku ?? "—"} · {product.category}</p>
                </div>
                <Badge variant={(product.stock ?? 0) > 10 ? "default" : (product.stock ?? 0) > 0 ? "secondary" : "destructive"}>
                  {(product.stock ?? 0) > 0 ? `${product.stock} left` : "Out of stock"}
                </Badge>
              </div>
              {product.description && <p className="text-sm mt-2 text-muted-foreground line-clamp-2">{product.description}</p>}
              <div className="flex items-center justify-between mt-3">
                <span className="font-bold text-lg">PKR {product.price.toLocaleString()}</span>
                <div className="flex gap-1">
                  <Dialog
                    open={editing?.id === product.id}
                    onOpenChange={(open) => setEditing(open ? { ...product } : null)}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">Edit</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
                      {editing && (
                        <div className="space-y-3 py-4">
                          <div><Label>Name</Label><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
                          <div className="grid grid-cols-2 gap-3">
                            <div><Label>Price</Label><Input type="number" value={editing.price} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
                            <div><Label>Stock</Label><Input type="number" value={editing.stock ?? 0} onChange={e => setEditing({ ...editing, stock: Number(e.target.value) })} /></div>
                          </div>
                          <div><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
                        </div>
                      )}
                      <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={() => updateMutation.mutate({ productId: editing.id, data: { name: editing.name, price: editing.price, stock: editing.stock, description: editing.description } })} disabled={updateMutation.isPending}>
                          {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate({ productId: product.id })} disabled={deleteMutation.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {products.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8">No products yet. Add your first product!</p>
        )}
      </div>
    </div>
  );
}

function ServicesTab({ providerId }: { providerId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: services = [], isLoading } = useListProviderServices(
    providerId,
    { query: { queryKey: getListProviderServicesQueryKey(providerId) } },
  );

  const createMutation = useCreateService({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProviderServicesQueryKey(providerId) });
        qc.invalidateQueries({ queryKey: getGetMyProviderStatsQueryKey() });
        toast({ title: "Service added" });
        setNew({ name: "", category: "", priceRange: "", description: "", duration: "" });
        setAddOpen(false);
      },
      onError: (err) => toast({ title: "Failed to add service", description: apiErrorReason(err), variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateService({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProviderServicesQueryKey(providerId) });
        toast({ title: "Service updated" });
        setEditing(null);
      },
      onError: (err) => toast({ title: "Failed to update service", description: apiErrorReason(err), variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteService({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProviderServicesQueryKey(providerId) });
        qc.invalidateQueries({ queryKey: getGetMyProviderStatsQueryKey() });
        toast({ title: "Service deleted" });
      },
      onError: (err) => toast({ title: "Failed to delete service", description: apiErrorReason(err), variant: "destructive" }),
    },
  });

  const [newS, setNew] = useState({ name: "", category: "", priceRange: "", description: "", duration: "" });
  const [editing, setEditing] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const handleAdd = () => {
    if (!newS.name || !newS.priceRange) return;
    createMutation.mutate({
      providerId,
      data: {
        name: newS.name,
        category: newS.category || "General",
        priceRange: newS.priceRange,
        description: newS.description || undefined,
        duration: newS.duration || undefined,
      } as any,
    });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold font-headline">Service Catalog</h3>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusCircle className="h-4 w-4 mr-2" />Add Service</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add New Service</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              <div><Label>Name</Label><Input value={newS.name} onChange={e => setNew({ ...newS, name: e.target.value })} placeholder="Service name" /></div>
              <div><Label>Category</Label><Input value={newS.category} onChange={e => setNew({ ...newS, category: e.target.value })} placeholder="Plumber" /></div>
              <div><Label>Price Range</Label><Input value={newS.priceRange} onChange={e => setNew({ ...newS, priceRange: e.target.value })} placeholder="PKR 500–2000" /></div>
              <div><Label>Duration</Label><Input value={newS.duration} onChange={e => setNew({ ...newS, duration: e.target.value })} placeholder="1–2 hours" /></div>
              <div><Label>Description</Label><Textarea value={newS.description} onChange={e => setNew({ ...newS, description: e.target.value })} placeholder="Describe the service" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Service
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {services.map((service) => (
          <Card key={service.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold">{service.name}</h4>
                <p className="text-sm text-muted-foreground">{service.category}{service.duration ? ` · ${service.duration}` : ""}</p>
                {service.description && <p className="text-sm mt-1">{service.description}</p>}
                <Badge variant="outline" className="mt-2">{service.priceRange}</Badge>
              </div>
              <div className="flex gap-1">
                <Dialog
                  open={editing?.id === service.id}
                  onOpenChange={(open) => setEditing(open ? { ...service } : null)}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">Edit</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Edit Service</DialogTitle></DialogHeader>
                    {editing && (
                      <div className="space-y-3 py-4">
                        <div><Label>Name</Label><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
                        <div><Label>Category</Label><Input value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} /></div>
                        <div><Label>Price Range</Label><Input value={editing.priceRange} onChange={e => setEditing({ ...editing, priceRange: e.target.value })} /></div>
                        <div><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
                      </div>
                    )}
                    <DialogFooter>
                      <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                      <Button onClick={() => updateMutation.mutate({ serviceId: editing.id, data: { name: editing.name, category: editing.category, priceRange: editing.priceRange, description: editing.description } })} disabled={updateMutation.isPending}>
                        {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate({ serviceId: service.id })} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {services.length === 0 && <p className="text-muted-foreground text-center py-8">No services yet. Add your first service!</p>}
      </div>
    </div>
  );
}

function OrdersTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  // New orders show up without a reload (polling pauses while the tab is in the background).
  const { data: orders = [], isLoading } = useListProviderOrders({
    query: { queryKey: getListProviderOrdersQueryKey(), refetchInterval: 15000 },
  });
  const updateStatus = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProviderOrdersQueryKey() });
        qc.invalidateQueries({ queryKey: getGetMyProviderStatsQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to update order", description: apiErrorReason(err), variant: "destructive" }),
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div>
      <h3 className="text-lg font-semibold font-headline mb-4">Orders &amp; Bookings</h3>
      {orders.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <ShoppingBag className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No orders yet. Share your listing to start receiving orders!</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Deliver to</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium font-mono text-xs">{order.id.slice(0, 8).toUpperCase()}</TableCell>
                  <TableCell>{order.customerName ?? "Customer"}</TableCell>
                  <TableCell className="max-w-[220px] text-sm">
                    <p>{order.deliveryAddress ?? "No address given"}</p>
                    {order.deliveryPhone && (
                      <a href={`tel:${order.deliveryPhone.replace(/\s/g, "")}`} className="text-primary hover:underline">
                        {order.deliveryPhone}
                      </a>
                    )}
                    {order.deliveryInstructions && (
                      <p className="text-xs text-muted-foreground">{order.deliveryInstructions}</p>
                    )}
                    {order.notes && <p className="text-xs text-muted-foreground italic">Note: {order.notes}</p>}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm">
                    {Array.isArray(order.items)
                      ? order.items.map((i: any) => `${i.quantity}× ${i.name}`).join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell>PKR {Number(order.total).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={statusBadge(order.status)}>{order.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{order.paymentMethod?.replace(/_/g, " ") ?? "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={order.status}
                      onValueChange={(v) => updateStatus.mutate({ orderId: order.id, data: { status: v as any } })}
                      disabled={order.status === "delivered" || order.status === "cancelled"}
                    >
                      <SelectTrigger className="h-8 w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function BookingsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: bookings = [], isLoading } = useListProviderBookings({
    query: { queryKey: getListProviderBookingsQueryKey(), refetchInterval: 15000 },
  });
  const updateStatus = useUpdateBookingStatus({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProviderBookingsQueryKey() });
        toast({ title: "Booking updated" });
      },
      onError: (err) => toast({ title: "Failed to update booking", description: apiErrorReason(err), variant: "destructive" }),
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div>
      <h3 className="text-lg font-semibold font-headline mb-4">Service Bookings</h3>
      {bookings.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <CalendarClock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No bookings yet. Customers who book your services will appear here.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium font-mono text-xs">{booking.id.slice(0, 8).toUpperCase()}</TableCell>
                  <TableCell>{booking.customerName ?? "Customer"}</TableCell>
                  <TableCell>
                    <span className="font-medium">{booking.serviceName}</span>
                    {booking.priceRange && <span className="text-xs text-muted-foreground block">{booking.priceRange}</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(booking.bookingDate).toLocaleDateString()}
                    <span className="text-xs text-muted-foreground block">{booking.timeSlot}</span>
                  </TableCell>
                  <TableCell className="max-w-[220px] text-sm">
                    <p className="truncate">{booking.address}</p>
                    {booking.notes && <p className="text-xs text-muted-foreground italic">Note: {booking.notes}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusBadge(booking.status)}>{booking.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={booking.status}
                      onValueChange={(v) => updateStatus.mutate({ bookingId: booking.id, data: { status: v as any } })}
                      disabled={booking.status === "cancelled"}
                    >
                      <SelectTrigger className="h-8 w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ReviewsTab({ providerId }: { providerId: string }) {
  const { data: reviews = [], isLoading } = useListProviderReviews(
    providerId,
    { query: { queryKey: getListProviderReviewsQueryKey(providerId) } },
  );

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div>
      <h3 className="text-lg font-semibold font-headline mb-4">Customer Reviews</h3>
      {reviews.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <Star className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No reviews yet. Complete some orders to get your first review!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{(review.customerName ?? "C")[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{review.customerName ?? "Customer"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Stars rating={review.rating} />
                </div>
                {review.comment && <p className="text-sm">{review.comment}</p>}
                {review.reply && (
                  <div className="mt-3 p-3 bg-muted rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Your reply:</p>
                    <p className="text-sm">{review.reply}</p>
                  </div>
                )}
                {!review.reply && (
                  <div className="flex items-center gap-2 mt-3">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Reply coming soon</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyticsTab({ stats, products }: { stats: any; products: any[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Revenue Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Revenue</span>
              <span className="font-bold text-lg">PKR {(stats?.totalRevenue ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Orders</span>
              <span className="font-semibold">{stats?.totalOrders ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pending Orders</span>
              <span className="font-semibold text-yellow-600">{stats?.pendingOrders ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">New Orders Today</span>
              <span className="font-semibold text-blue-600">{stats?.newOrdersToday ?? 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5" /> Reputation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Average Rating</span>
              <div className="flex items-center gap-2">
                <Stars rating={Math.round(stats?.avgRating ?? 0)} />
                <span className="font-bold">{Number(stats?.avgRating ?? 0).toFixed(1)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Reviews</span>
              <span className="font-semibold">{stats?.reviewCount ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Products</span>
              <span className="font-semibold">{stats?.totalProducts ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Services</span>
              <span className="font-semibold">{stats?.totalServices ?? 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Product Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-muted-foreground text-sm">No products yet.</p>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <div key={product.id} className="flex items-center justify-between">
                  <span className="text-sm flex-1 truncate">{product.name}</span>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${Math.min(((product.stock ?? 0) / 100) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-14 text-right">{product.stock ?? 0} left</span>
                    <span className="text-xs font-medium w-20 text-right">PKR {product.price.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Store Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: "Profile Views", value: "—" },
              { label: "Click-to-Call", value: "—" },
              { label: "Direction Requests", value: "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

function MessagesTab() {
  const [, navigate] = useLocation();
  const { data: conversations, isLoading } = useListConversations({
    query: { queryKey: getListConversationsQueryKey(), refetchInterval: 5000 },
  });
  const customerChats = (Array.isArray(conversations) ? conversations : []).filter(
    (c) => c.viewerRole === "provider",
  );

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>;
  }

  if (customerChats.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3" />
          <p>No customer messages yet.</p>
          <p className="text-sm mt-1">When a customer messages your store from its page, the chat appears here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ConversationsList
        conversations={customerChats}
        onSelect={(id) => navigate(`/messages?c=${id}`)}
      />
    </Card>
  );
}

export default function ProviderDashboardPage() {
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();
  const { toast } = useToast();

  const {
    data: provider,
    isLoading: providerLoading,
    error: providerError,
    refetch: refetchProvider,
    isFetching: providerFetching,
  } = useGetMyProvider({
    query: { enabled: !!user, queryKey: getGetMyProviderQueryKey(), retry: false },
  });
  // Only a 404 means "no store yet"; any other failure is a load error the seller can retry.
  const providerLoadFailed = !!providerError && (providerError as { status?: number }).status !== 404;
  const { data: stats, isLoading: statsLoading } = useGetMyProviderStats({
    query: { enabled: !!provider, queryKey: getGetMyProviderStatsQueryKey() },
  });
  const { data: subscription } = useGetMySubscription({
    query: { enabled: !!provider, queryKey: getGetMySubscriptionQueryKey(), retry: false },
  });
  const { data: products = [] } = useListProviderProducts(
    provider?.id ?? "",
    {},
    { query: { enabled: !!provider, queryKey: getListProviderProductsQueryKey(provider?.id ?? "", {}) } },
  );

  const updateProviderMutation = useUpdateMyProvider({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMyProviderQueryKey() });
        toast({ title: "Business details updated" });
        setEditOpen(false);
      },
      onError: (err) => toast({ title: "Failed to update details", description: apiErrorReason(err), variant: "destructive" }),
    },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editLocation, setEditLocation] = useState(initialShopLocation);
  const editRadiusError = radiusProblem(editLocation.radiusKm);

  // ── loading / auth gates ────────────────────────────────────────────────────

  if (!isLoaded || (!!user && providerLoading)) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
        <Briefcase className="h-16 w-16 text-primary mb-4" />
        <h1 className="text-2xl font-bold font-headline mb-2">Provider Dashboard</h1>
        <p className="text-muted-foreground mb-6">Sign in to manage your business.</p>
        <Button asChild><Link href="/sign-in">Sign In</Link></Button>
      </div>
    );
  }

  if (!provider && providerLoadFailed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold font-headline mb-2">Couldn't load your store</h1>
        <p className="text-muted-foreground mb-6">Check your connection and try again.</p>
        <Button onClick={() => refetchProvider()} disabled={providerFetching}>
          {providerFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Try again
        </Button>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-4">
          <AlertCircle className="h-10 w-10 text-yellow-500" />
        </div>
        <h1 className="text-2xl font-bold font-headline mb-2">No Provider Profile Found</h1>
        <p className="text-muted-foreground mb-6">You haven't registered as a provider yet. It only takes a minute.</p>
        <Button asChild><Link href="/become-provider">Register Your Business</Link></Button>
      </div>
    );
  }

  const providerId = provider.id;

  const openEdit = () => {
    setEditForm({
      name: provider.name ?? "",
      description: provider.description ?? "",
      address: provider.address ?? "",
      phone: provider.phone ?? "",
      email: provider.email ?? "",
      openingHours: provider.openingHours ?? "",
      isOpen: provider.isOpen ?? true,
    });
    setEditLocation(initialShopLocation(provider));
    setEditOpen(true);
  };
  const hasMapPoint = provider.lat != null && provider.lng != null;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Cover Banner */}
      <div className="relative rounded-xl overflow-hidden h-40 md:h-56 bg-muted group">
        {provider.coverUrl
          ? <img src={provider.coverUrl} alt="Store Banner" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-r from-primary/20 to-primary/5 flex items-center justify-center"><Briefcase className="h-16 w-16 text-primary/20" /></div>}
      </div>

      {/* Business Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end gap-4 -mt-10 px-4 relative z-10">
        <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
          <AvatarImage src={provider.avatarUrl ?? undefined} alt={provider.name} />
          <AvatarFallback className="text-xl bg-primary/10 text-primary">{provider.name[0]}</AvatarFallback>
        </Avatar>

        <div className="flex-1 pb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold font-headline">{provider.name}</h1>
            <Badge className={provider.isOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
              {provider.isOpen ? "Open" : "Closed"}
            </Badge>
            {provider.isVerified && (
              <Badge variant="secondary" className="gap-1"><BadgeCheck className="h-3.5 w-3.5" /> Verified</Badge>
            )}
            {subscription && (
              <Badge variant="outline" className="capitalize">{subscription.planName ?? subscription.planId} Plan</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground capitalize">{provider.type} · {provider.category ?? "General"}</p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
            {provider.address && <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5" /> {provider.address}</span>}
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              {Number(stats?.avgRating ?? provider.rating ?? 0).toFixed(1)} ({stats?.reviewCount ?? provider.reviewCount ?? 0} reviews)
            </span>
          </div>
        </div>

        <div className="flex gap-2 pb-1 flex-wrap">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Edit3 className="h-4 w-4 mr-2" /> Edit Business
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Edit Business Details</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div><Label>Name</Label><Input value={editForm.name ?? ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={editForm.email ?? ""} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
                <div><Label>Address</Label><Input value={editForm.address ?? ""} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={editForm.phone ?? ""} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea value={editForm.description ?? ""} onChange={e => setEditForm({ ...editForm, description: e.target.value })} /></div>
                <div><Label>Opening Hours</Label><Input value={editForm.openingHours ?? ""} onChange={e => setEditForm({ ...editForm, openingHours: e.target.value })} /></div>
                <div className="flex items-center justify-between">
                  <Label>Store Status</Label>
                  <Button type="button" variant={editForm.isOpen ? "default" : "outline"} size="sm"
                    onClick={() => setEditForm({ ...editForm, isOpen: !editForm.isOpen })}>
                    {editForm.isOpen ? "Open" : "Closed"}
                  </Button>
                </div>
                <ShopLocationFields providerType={provider.type} value={editLocation} onChange={setEditLocation} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => updateProviderMutation.mutate({ data: { ...editForm, ...shopLocationRequest(editLocation) } })}
                  disabled={updateProviderMutation.isPending || editRadiusError !== null}
                >
                  {updateProviderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button asChild>
            <Link href="/"><ShoppingCart className="mr-2 h-4 w-4" /> Switch to Buying</Link>
          </Button>
        </div>
      </div>

      {!hasMapPoint && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <MapPin className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Customers near you can't find you yet</p>
              <p className="text-sm text-muted-foreground">
                "Near me" lists only show businesses with a location on the map. Set yours in Edit Business.
              </p>
            </div>
            <Button size="sm" onClick={openEdit}>Set location</Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-xl font-bold">PKR {(stats?.totalRevenue ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-green-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" /> All time</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Orders</p>
                  <p className="text-xl font-bold">{stats?.totalOrders ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{stats?.newOrdersToday ?? 0} today</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Listings</p>
                  <p className="text-xl font-bold">{stats?.totalProducts ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{stats?.totalServices ?? 0} services</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rating</p>
                  <p className="text-xl font-bold">{Number(stats?.avgRating ?? 0).toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">{stats?.reviewCount ?? 0} reviews</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="listings">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="listings"><ListChecks className="h-4 w-4 mr-2" /> Listings</TabsTrigger>
          <TabsTrigger value="orders"><ShoppingBag className="h-4 w-4 mr-2" /> Orders</TabsTrigger>
          <TabsTrigger value="bookings"><CalendarClock className="h-4 w-4 mr-2" /> Bookings</TabsTrigger>
          <TabsTrigger value="messages"><MessageSquare className="h-4 w-4 mr-2" /> Messages</TabsTrigger>
          <TabsTrigger value="reviews"><Star className="h-4 w-4 mr-2" /> Reviews</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-2" /> Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-6">
          <Tabs defaultValue="products">
            <TabsList className="grid w-full grid-cols-2 max-w-xs">
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="services">Services</TabsTrigger>
            </TabsList>
            <TabsContent value="products" className="mt-4"><ProductsTab providerId={providerId} /></TabsContent>
            <TabsContent value="services" className="mt-4"><ServicesTab providerId={providerId} /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="orders" className="mt-6"><OrdersTab /></TabsContent>
        <TabsContent value="bookings" className="mt-6"><BookingsTab /></TabsContent>
        <TabsContent value="messages" className="mt-6"><MessagesTab /></TabsContent>
        <TabsContent value="reviews" className="mt-6"><ReviewsTab providerId={providerId} /></TabsContent>
        <TabsContent value="analytics" className="mt-6"><AnalyticsTab stats={stats} products={products} /></TabsContent>
      </Tabs>
    </div>
  );
}
