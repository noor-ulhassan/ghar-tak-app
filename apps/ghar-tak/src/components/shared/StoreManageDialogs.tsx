import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiErrorReason } from "@/lib/api-error";
import {
  useUpdateMyProvider,
  useCreateProduct, useUpdateProduct,
  useCreateService, useUpdateService,
  getGetMyProviderQueryKey, getGetProviderQueryKey,
  getListProviderProductsQueryKey, getListProviderServicesQueryKey,
  type Provider, type Product, type Service,
  type UpdateProviderRequest,
} from "@workspace/api-client-react";

// ─── Edit shop profile (owner) ────────────────────────────────────────────────

export function EditShopDialog({
  open, onOpenChange, shop,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shop: Provider;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<UpdateProviderRequest>({});

  useEffect(() => {
    if (open) {
      setForm({
        name: shop.name ?? "",
        category: shop.category ?? "",
        description: shop.description ?? "",
        address: shop.address ?? "",
        phone: shop.phone ?? "",
        email: shop.email ?? "",
        openingHours: shop.openingHours ?? "",
        avatarUrl: shop.avatarUrl ?? "",
        coverUrl: shop.coverUrl ?? "",
        isOpen: shop.isOpen ?? true,
      });
    }
  }, [open, shop]);

  const mutation = useUpdateMyProvider({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMyProviderQueryKey() });
        qc.invalidateQueries({ queryKey: getGetProviderQueryKey(shop.id) });
        toast({ title: "Shop updated" });
        onOpenChange(false);
      },
      onError: (err) => toast({ title: "Failed to update shop", description: apiErrorReason(err), variant: "destructive" }),
    },
  });

  const set = (patch: Partial<UpdateProviderRequest>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Shop Details</DialogTitle></DialogHeader>
        <div className="space-y-3 py-4">
          <div><Label>Name</Label><Input value={form.name ?? ""} onChange={(e) => set({ name: e.target.value })} /></div>
          <div><Label>Category</Label><Input value={form.category ?? ""} onChange={(e) => set({ category: e.target.value })} placeholder="Groceries, Pharmacy…" /></div>
          <div><Label>Description</Label><Textarea value={form.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email ?? ""} onChange={(e) => set({ email: e.target.value })} /></div>
          </div>
          <div><Label>Address</Label><Input value={form.address ?? ""} onChange={(e) => set({ address: e.target.value })} /></div>
          <div><Label>Opening Hours</Label><Input value={form.openingHours ?? ""} onChange={(e) => set({ openingHours: e.target.value })} placeholder="Mon–Sat 9am–9pm" /></div>
          <div><Label>Logo Image URL</Label><Input value={form.avatarUrl ?? ""} onChange={(e) => set({ avatarUrl: e.target.value })} placeholder="https://…" /></div>
          <div><Label>Cover Image URL</Label><Input value={form.coverUrl ?? ""} onChange={(e) => set({ coverUrl: e.target.value })} placeholder="https://…" /></div>
          <div className="flex items-center justify-between">
            <Label>Shop Status</Label>
            <Button type="button" variant={form.isOpen ? "default" : "outline"} size="sm"
              onClick={() => set({ isOpen: !form.isOpen })}>
              {form.isOpen ? "Open" : "Closed"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate({ data: form })}
            disabled={mutation.isPending || !form.name?.trim()}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product add/edit (owner) ────────────────────────────────────────────────

type ProductFormState = {
  name: string; price: string; stock: string;
  category: string; sku: string; imageUrl: string; description: string;
};

const emptyProduct: ProductFormState = { name: "", price: "", stock: "", category: "", sku: "", imageUrl: "", description: "" };

export function ProductFormDialog({
  open, onOpenChange, providerId, product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  product: Product | null; // null = add mode
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<ProductFormState>(emptyProduct);

  useEffect(() => {
    if (open) {
      setForm(product
        ? {
            name: product.name, price: String(product.price), stock: String(product.stock ?? 0),
            category: product.category ?? "", sku: product.sku ?? "",
            imageUrl: product.imageUrl ?? "", description: product.description ?? "",
          }
        : emptyProduct);
    }
  }, [open, product]);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListProviderProductsQueryKey(providerId) });

  const createMutation = useCreateProduct({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Product added" }); onOpenChange(false); },
      onError: (err) => toast({ title: "Failed to add product", description: apiErrorReason(err), variant: "destructive" }),
    },
  });
  const updateMutation = useUpdateProduct({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Product updated" }); onOpenChange(false); },
      onError: (err) => toast({ title: "Failed to update product", description: apiErrorReason(err), variant: "destructive" }),
    },
  });

  const set = (patch: Partial<ProductFormState>) => setForm((f) => ({ ...f, ...patch }));
  const isAdd = !product;

  const save = () => {
    const data = {
      name: form.name.trim(),
      price: Number(form.price),
      stock: Number(form.stock) || 0,
      category: form.category.trim() || "General",
    };
    const optional = {
      sku: form.sku.trim(),
      imageUrl: form.imageUrl.trim(),
      description: form.description.trim(),
    };
    if (isAdd) {
      createMutation.mutate({
        providerId,
        data: {
          ...data,
          sku: optional.sku || undefined,
          imageUrl: optional.imageUrl || undefined,
          description: optional.description || undefined,
        },
      });
    } else if (product) {
      // An emptied field is sent as null so the server clears it (undefined would keep the old value).
      updateMutation.mutate({
        productId: product.id,
        data: {
          ...data,
          sku: optional.sku || null,
          imageUrl: optional.imageUrl || null,
          description: optional.description || null,
        },
      });
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isAdd ? "Add New Product" : "Edit Product"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-4">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Product name" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Price (PKR)</Label><Input type="number" value={form.price} onChange={(e) => set({ price: e.target.value })} placeholder="200" /></div>
            <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => set({ stock: e.target.value })} placeholder="50" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => set({ category: e.target.value })} placeholder="Groceries" /></div>
            <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => set({ sku: e.target.value })} placeholder="SKU-001" /></div>
          </div>
          <div><Label>Image URL</Label><Input value={form.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://…" /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Brief description" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={pending || !form.name.trim() || form.price === ""}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isAdd ? "Add Product" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Service add/edit (owner) ────────────────────────────────────────────────

type ServiceFormState = {
  name: string; category: string; priceRange: string; duration: string; description: string;
};

const emptyService: ServiceFormState = { name: "", category: "", priceRange: "", duration: "", description: "" };

export function ServiceFormDialog({
  open, onOpenChange, providerId, service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  service: Service | null;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<ServiceFormState>(emptyService);

  useEffect(() => {
    if (open) {
      setForm(service
        ? {
            name: service.name, category: service.category ?? "",
            priceRange: service.priceRange, duration: service.duration ?? "",
            description: service.description ?? "",
          }
        : emptyService);
    }
  }, [open, service]);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListProviderServicesQueryKey(providerId) });

  const createMutation = useCreateService({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Service added" }); onOpenChange(false); },
      onError: (err) => toast({ title: "Failed to add service", description: apiErrorReason(err), variant: "destructive" }),
    },
  });
  const updateMutation = useUpdateService({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Service updated" }); onOpenChange(false); },
      onError: (err) => toast({ title: "Failed to update service", description: apiErrorReason(err), variant: "destructive" }),
    },
  });

  const set = (patch: Partial<ServiceFormState>) => setForm((f) => ({ ...f, ...patch }));
  const isAdd = !service;

  const save = () => {
    const data = {
      name: form.name.trim(),
      category: form.category.trim() || "General",
      priceRange: form.priceRange.trim(),
    };
    const duration = form.duration.trim();
    const description = form.description.trim();
    if (isAdd) {
      createMutation.mutate({
        providerId,
        data: { ...data, duration: duration || undefined, description: description || undefined },
      });
    } else if (service) {
      // An emptied field is sent as null so the server clears it (undefined would keep the old value).
      updateMutation.mutate({
        serviceId: service.id,
        data: { ...data, duration: duration || null, description: description || null },
      });
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isAdd ? "Add New Service" : "Edit Service"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-4">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Service name" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => set({ category: e.target.value })} placeholder="Plumber" /></div>
            <div><Label>Duration</Label><Input value={form.duration} onChange={(e) => set({ duration: e.target.value })} placeholder="1–2 hours" /></div>
          </div>
          <div><Label>Price Range</Label><Input value={form.priceRange} onChange={(e) => set({ priceRange: e.target.value })} placeholder="PKR 500–2000" /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Describe the service" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={pending || !form.name.trim() || !form.priceRange.trim()}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isAdd ? "Add Service" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
