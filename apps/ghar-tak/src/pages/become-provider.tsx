import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, Store, CheckCircle, Loader2 } from "lucide-react";
import { Link, useLocation } from 'wouter';
import { useToast } from "@/hooks/use-toast";
import { apiErrorReason } from "@/lib/api-error";
import CategorySelect from "@/components/shared/CategorySelect";
import ShopLocationFields, { initialShopLocation, radiusProblem, shopLocationRequest } from "@/components/shared/ShopLocationFields";
import { useCustomerPoint } from "@/hooks/useNearby";
import { useCreateProvider } from "@workspace/api-client-react";
import { useState } from "react";
import { useUser } from "@clerk/react";

export default function BecomeProviderPage() {
  const { toast } = useToast();
  const { user, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const createProvider = useCreateProvider();
  // Sellers often sign up from the shop, so the map opens where the site last saw them.
  const lastSeenAt = useCustomerPoint();
  const [shopLocation, setShopLocation] = useState(initialShopLocation);
  const radiusError = radiusProblem(shopLocation.radiusKm);

  const [formData, setFormData] = useState({
    name: "",
    type: "store",
    description: "",
    address: "",
    phone: "",
    category: "",
    email: "",
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (radiusError) return;
    createProvider.mutate(
      {
        data: {
          name: formData.name,
          type: formData.type as any,
          description: formData.description,
          address: formData.address,
          phone: formData.phone,
          category: formData.category,
          email: formData.email,
          ...shopLocationRequest(shopLocation),
        }
      },
      {
        onSuccess: () => {
          toast({
            title: "Application Submitted!",
            description: "Welcome! Redirecting you to your new provider dashboard.",
          });
          setLocation('/dashboard');
        },
        onError: (err) => {
          toast({
            title: "Error",
            description: apiErrorReason(err) ?? "Failed to create provider account.",
            variant: "destructive",
          });
        }
      }
    );
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-3xl">
      <div className="text-center mb-12">
        <Briefcase className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-bold font-headline text-primary">Join Ghar Tak as a Provider</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Offer your products or services to thousands of local customers.
        </p>
      </div>

      {!isLoaded ? (
        <Card className="shadow-xl text-center py-10">
          <CardContent>
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          </CardContent>
        </Card>
      ) : user ? (
        <Card className="shadow-xl border-primary/20">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-2xl font-headline">Register Your Business</CardTitle>
              <CardDescription>Fill out the form below to get started. You'll get access to the dashboard immediately.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input id="businessName" placeholder="e.g., Mike's Plumbing, FreshMart Online" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input id="contactEmail" type="email" placeholder="you@example.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="businessType">Type of Business</Label>
                  <select id="businessType" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" required value={formData.type} onChange={(e) => {
                    // Stores and restaurants share one category list; only a switch to or from Service Provider changes it.
                    const sameList = (e.target.value === "service") === (formData.type === "service");
                    setFormData({...formData, type: e.target.value, category: sameList ? formData.category : ""});
                  }}>
                    <option value="store">Store</option>
                    <option value="service">Service Provider</option>
                    <option value="restaurant">Restaurant</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <CategorySelect id="category" providerType={formData.type} value={formData.category} onChange={(category) => setFormData({...formData, category})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Business Description</Label>
                <Textarea id="description" placeholder="Tell us a bit about what you offer..." rows={4} required value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="address">Business Address</Label>
                  <Input id="address" placeholder="Shop no., street, area, city" required value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" placeholder="+92 300 1234567" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              <ShopLocationFields providerType={formData.type} value={shopLocation} onChange={setShopLocation} openAt={lastSeenAt} />
              <Button type="submit" className="w-full text-lg py-6" disabled={createProvider.isPending || radiusError !== null}>
                {createProvider.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                Submit Registration
              </Button>
            </CardContent>
          </form>
          <CardFooter className="flex flex-col space-y-2 items-center text-sm text-muted-foreground">
            <p>By applying, you agree to our Terms for Providers.</p>
          </CardFooter>
        </Card>
      ) : (
        <Card className="shadow-xl text-center py-10">
          <CardContent>
            <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Sign in to Register</h2>
            <p className="text-muted-foreground mb-6">You need a Ghar Tak user account before you can register as a provider.</p>
            <Button size="lg" asChild>
              <Link href="/sign-in">Sign In or Create Account</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="mt-16 text-center">
        <h2 className="text-2xl font-headline font-semibold mb-6">Why Partner with Ghar Tak?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center p-4 rounded-lg bg-card border">
            <Store className="h-12 w-12 text-accent mb-3" />
            <h3 className="text-lg font-semibold mb-1">Reach More Customers</h3>
            <p className="text-muted-foreground text-sm">Expand your reach in your local community and connect with new customers.</p>
          </div>
          <div className="flex flex-col items-center p-4 rounded-lg bg-card border">
            <Briefcase className="h-12 w-12 text-accent mb-3" />
            <h3 className="text-lg font-semibold mb-1">Easy Management</h3>
            <p className="text-muted-foreground text-sm">Manage your listings, orders, and bookings through our simple platform.</p>
          </div>
          <div className="flex flex-col items-center p-4 rounded-lg bg-card border">
            <CheckCircle className="h-12 w-12 text-accent mb-3" />
            <h3 className="text-lg font-semibold mb-1">Grow Your Business</h3>
            <p className="text-muted-foreground text-sm">Leverage our marketing and tools to increase your sales and service bookings.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
