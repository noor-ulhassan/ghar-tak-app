import {
  useGetProvider, useListProviderProducts, useListProviderReviews, useListProviderServices,
  useSendProviderMessage, useGetMyProvider, useDeleteProduct, useDeleteService,
  getGetProviderQueryKey, getListProviderProductsQueryKey, getListProviderReviewsQueryKey,
  getListProviderServicesQueryKey, getGetMyProviderQueryKey,
  type Product, type Service,
} from '@workspace/api-client-react';
import ProductCard from '@/components/shared/ProductCard';
import { EditShopDialog, ProductFormDialog, ServiceFormDialog } from '@/components/shared/StoreManageDialogs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Star, Clock, ArrowLeft, Heart, Loader2, MessageSquare, Share2, Phone,
  Edit3, Trash2, PlusCircle, Wrench, ShoppingCart,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useFavorites } from '@/hooks/useFavorites';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { apiErrorReason } from '@/lib/api-error';
import { useUser } from '@clerk/react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export default function StoreDetailPage({ params }: { params: { id: string } }) {
  const { user } = useUser();
  const { data: store, isLoading: storeLoading } = useGetProvider(params.id, { query: { enabled: !!params.id, queryKey: getGetProviderQueryKey(params.id) } });
  const { data: products, isLoading: productsLoading } = useListProviderProducts(params.id, undefined, { query: { enabled: !!params.id, queryKey: getListProviderProductsQueryKey(params.id) } });
  const { data: services, isLoading: servicesLoading } = useListProviderServices(params.id, { query: { enabled: !!params.id, queryKey: getListProviderServicesQueryKey(params.id) } });
  const { data: reviews, isLoading: reviewsLoading } = useListProviderReviews(params.id, { query: { enabled: !!params.id, queryKey: getListProviderReviewsQueryKey(params.id) } });
  const { data: myProvider } = useGetMyProvider({ query: { enabled: !!user, queryKey: getGetMyProviderQueryKey(), retry: false } });
  const { favouriteIds, toggleFavourite } = useFavorites();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addItem, openCart } = useCart();

  const isOwner = !!store && !!myProvider && myProvider.id === store.id;

  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [editShopOpen, setEditShopOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  const sendMessage = useSendProviderMessage({
    mutation: {
      onSuccess: (data) => {
        setMessageDialogOpen(false);
        setMessageDraft("");
        toast({ title: "Message sent", description: `Chat opened with ${store?.name ?? "the store"}.` });
        navigate(`/messages?c=${data.conversationId}`);
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Message failed", description: error.message });
      },
    },
  });

  // Refresh the lists after a delete so the removed card disappears straight away.
  const deleteProduct = useDeleteProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProviderProductsQueryKey(params.id) });
        toast({ title: "Product deleted" });
      },
      onError: (err) => toast({ variant: "destructive", title: "Failed to delete product", description: apiErrorReason(err) }),
    },
  });
  const deleteService = useDeleteService({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProviderServicesQueryKey(params.id) });
        toast({ title: "Service deleted" });
      },
      onError: (err) => toast({ variant: "destructive", title: "Failed to delete service", description: apiErrorReason(err) }),
    },
  });

  const isFav = store ? favouriteIds.has(store.id) : false;

  // Open the message dialog with a prefilled enquiry (login-gated).
  const enquire = (text: string) => {
    if (!user) {
      navigate("/sign-in");
      return;
    }
    setMessageDraft(text);
    setMessageDialogOpen(true);
  };

  const openMessageDialog = () => enquire("");

  const handleSendMessage = () => {
    const content = messageDraft.trim();
    if (!content || sendMessage.isPending) return;
    sendMessage.mutate({ providerId: params.id, data: { content } });
  };

  const shareStore = async () => {
    if (!store) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: store.name, url });
        return;
      } catch {
        // user dismissed the share sheet — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Share it with your customers." });
    } catch {
      toast({ variant: "destructive", title: "Could not copy link" });
    }
  };

  const addDetailToCart = (product: Product) => {
    if (!store) return;
    const result = addItem(product, store.id, store.name);
    if (result === 'replaced') {
      toast({
        title: 'Cart updated',
        description: `Your previous cart was replaced with items from ${store.name}.`,
      });
    }
    setDetailProduct(null);
    openCart();
  };

  if (storeLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>;
  }

  if (!store) {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold">Store not found</h1>
        <Link href="/stores" className="text-primary hover:underline mt-4 inline-block">
          Back to all stores
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link href="/stores" className="flex items-center text-primary hover:underline mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to All Stores
      </Link>

      <Card className="overflow-hidden shadow-xl">
        <CardHeader className="p-0 relative">
          <div className="aspect-[16/5] w-full relative">
            <img
              src={store.coverUrl || store.avatarUrl || `https://placehold.co/1200x400.png?text=${encodeURIComponent(store.name)}`}
              alt={`${store.name} banner`}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {isOwner ? (
              <Button
                variant="secondary"
                className="bg-background/70 hover:bg-background"
                onClick={() => setEditShopOpen(true)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Shop
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="bg-background/70 hover:bg-background"
                onClick={openMessageDialog}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Message
              </Button>
            )}
            <Button
              variant="secondary"
              size="icon"
              className="bg-background/70 hover:bg-background"
              onClick={shareStore}
              aria-label="Share this store"
            >
              <Share2 className="h-5 w-5" />
            </Button>
            {!isOwner && (
              <Button
                variant="secondary"
                size="icon"
                className="bg-background/70 hover:bg-background"
                onClick={() => toggleFavourite(store.id)}
                aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
              >
                <Heart className={`h-5 w-5 ${isFav ? 'fill-destructive text-destructive' : 'text-muted-foreground hover:text-destructive'}`} />
                <span className="sr-only">Favorite</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between">
            <div className="flex-grow">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <CardTitle className="text-3xl font-bold font-headline">{store.name}</CardTitle>
                <Badge variant="outline">{store.category || 'General'}</Badge>
                <Badge className={store.isOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                  {store.isOpen ? "Open" : "Closed"}
                </Badge>
              </div>
              <CardDescription className="text-muted-foreground mb-3 max-w-2xl">{store.description}</CardDescription>
            </div>
            <div className="text-sm text-muted-foreground space-y-1 md:text-right mt-4 md:mt-0 flex-shrink-0 md:pl-6">
              <div className="flex items-center md:justify-end">
                <MapPin className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
                <span>{store.address || 'Location not specified'}</span>
              </div>
              {store.phone && (
                <div className="flex items-center md:justify-end">
                  <Phone className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
                  <a href={`tel:${store.phone.replace(/\s/g, '')}`} className="hover:text-primary hover:underline">
                    {store.phone}
                  </a>
                </div>
              )}
              <div className="flex items-center md:justify-end space-x-4">
                {store.rating > 0 && (
                  <div className="flex items-center">
                    <Star className="h-4 w-4 mr-1 text-yellow-500 fill-yellow-500" />
                    <span>{store.rating.toFixed(1)} rating ({store.reviewCount} reviews)</span>
                  </div>
                )}
                {store.openingHours && (
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{store.openingHours}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Products */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold font-headline">Products from {store.name}</h2>
          {isOwner && (
            <Button size="sm" onClick={() => { setEditingProduct(null); setProductDialogOpen(true); }}>
              <PlusCircle className="h-4 w-4 mr-2" /> Add Product
            </Button>
          )}
        </div>
        {productsLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
        ) : !Array.isArray(products) || products.length === 0 ? (
          <p className="text-muted-foreground">
            {isOwner ? "No products yet. Add your first product to start selling!" : "No products listed for this store yet."}
          </p>
        ) : (
          <ScrollArea className="w-full whitespace-nowrap rounded-md">
            <div className="flex w-max space-x-4 p-4">
              {products.map(product => (
                <div key={product.id} className="w-64 whitespace-normal">
                  {isOwner && (
                    <div className="flex gap-1 mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => { setEditingProduct(product); setProductDialogOpen(true); }}
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteProduct.mutate({ productId: product.id })}
                        disabled={deleteProduct.isPending}
                        aria-label={`Delete ${product.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <ProductCard
                    product={product}
                    providerId={store.id}
                    providerName={store.name}
                    onSelect={isOwner ? undefined : (p) => setDetailProduct(p)}
                  />
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </section>

      <Separator />

      {/* Services */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold font-headline">Services by {store.name}</h2>
            {Array.isArray(services) && services.length > 0 && (
              <Badge variant="secondary">{services.length}</Badge>
            )}
          </div>
          {isOwner && (
            <Button size="sm" onClick={() => { setEditingService(null); setServiceDialogOpen(true); }}>
              <PlusCircle className="h-4 w-4 mr-2" /> Add Service
            </Button>
          )}
        </div>
        {servicesLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
        ) : !Array.isArray(services) || services.length === 0 ? (
          <p className="text-muted-foreground">
            {isOwner ? "No services yet. Add a service so customers can book you!" : "No services listed for this store yet."}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((service) => (
              <Card key={service.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-semibold">{service.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {service.category || "General"}
                        {service.duration ? ` · ${service.duration}` : ""}
                      </p>
                      {service.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{service.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="flex-shrink-0">{service.priceRange}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {isOwner ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => { setEditingService(service); setServiceDialogOpen(true); }}
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteService.mutate({ serviceId: service.id })}
                          disabled={deleteService.isPending}
                          aria-label={`Delete ${service.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => enquire(`Hi, I'd like to book "${service.name}" (${service.priceRange}). Is it available?`)}
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1" /> Enquire / Book
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Reviews */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold font-headline">Customer Reviews</h2>
          {reviews && reviews.length > 0 && (
            <Badge variant="secondary">{reviews.length}</Badge>
          )}
        </div>

        {reviewsLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
        ) : !Array.isArray(reviews) || reviews.length === 0 ? (
          <p className="text-muted-foreground">No reviews yet. Be the first to review this store!</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarImage src={review.customerAvatarUrl ?? undefined} />
                    <AvatarFallback>{(review.customerName ?? 'A')[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-medium text-sm">{review.customerName ?? 'Anonymous'}</span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>
                    )}
                    {review.createdAt && (
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {new Date(review.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Message dialog (also used for prefilled product/service enquiries) */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message {store.name}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={messageDraft}
            onChange={(e) => setMessageDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask about products, prices, delivery…"
            className="min-h-[120px]"
            maxLength={2000}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendMessage} disabled={!messageDraft.trim() || sendMessage.isPending}>
              {sendMessage.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Owner dialogs */}
      <EditShopDialog open={editShopOpen} onOpenChange={setEditShopOpen} shop={store} />
      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        providerId={store.id}
        product={editingProduct}
      />
      <ServiceFormDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        providerId={store.id}
        service={editingService}
      />

      {/* Customer product detail */}
      <Dialog open={!!detailProduct} onOpenChange={(open) => { if (!open) setDetailProduct(null); }}>
        <DialogContent>
          {detailProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{detailProduct.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
                  <img
                    src={detailProduct.imageUrl || `https://placehold.co/600x400.png?text=${encodeURIComponent(detailProduct.name)}`}
                    alt={detailProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {detailProduct.category && <Badge variant="outline">{detailProduct.category}</Badge>}
                  <Badge variant={(detailProduct.stock ?? 0) > 0 ? "secondary" : "destructive"}>
                    {(detailProduct.stock ?? 0) > 0 ? `${detailProduct.stock} in stock` : "Out of stock"}
                  </Badge>
                  {detailProduct.sku && <span className="text-xs text-muted-foreground">SKU: {detailProduct.sku}</span>}
                </div>
                <p className="text-2xl font-bold text-primary">PKR {Number(detailProduct.price ?? 0).toLocaleString()}</p>
                {detailProduct.description && (
                  <p className="text-sm text-muted-foreground">{detailProduct.description}</p>
                )}
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="sm:flex-1"
                  onClick={() => enquire(`Hi, I'm interested in "${detailProduct.name}" (PKR ${Number(detailProduct.price).toLocaleString()}). Is it available?`)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" /> Ask about this
                </Button>
                <Button
                  className="sm:flex-1"
                  onClick={() => addDetailToCart(detailProduct)}
                  disabled={(detailProduct.stock ?? 0) <= 0}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {(detailProduct.stock ?? 0) > 0 ? "Add to Cart" : "Out of Stock"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
