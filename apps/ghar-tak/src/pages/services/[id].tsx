import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation as useRouterLocation } from 'wouter';
import { useUser } from '@clerk/react';
import {
  useCreateBooking,
  useGetProvider,
  useListAddresses,
  useListProviderReviews,
  useListProviderServices,
  useSendProviderMessage,
  type Service,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from '@/hooks/useLocation';
import { formatDistance, providerDistance } from '@/lib/geo';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Send,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

const TIME_SLOTS = [
  '09:00 - 11:00',
  '11:00 - 13:00',
  '13:00 - 15:00',
  '15:00 - 17:00',
  '17:00 - 19:00',
];

function todayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

export default function ServiceProviderDetailPage({ params }: { params: { category: string; id: string } }) {
  const { user } = useUser();
  const [, navigate] = useRouterLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { location, hasRealLocation } = useLocation();

  const { data: provider, isLoading, isError } = useGetProvider(params.id, {
    query: { enabled: !!params.id, queryKey: ['getProvider', params.id] },
  });
  const { data: services, isLoading: servicesLoading } = useListProviderServices(params.id, {
    query: { enabled: !!params.id, queryKey: ['listProviderServices', params.id] },
  });
  const { data: reviews } = useListProviderReviews(params.id, {
    query: { enabled: !!params.id, queryKey: ['listProviderReviews', params.id] },
  });
  const { data: addresses } = useListAddresses({
    query: { enabled: !!user, queryKey: ['listAddresses'] },
  });

  const serviceList: Service[] = Array.isArray(services) ? services : [];
  const reviewList = Array.isArray(reviews) ? reviews : [];

  const [bookOpen, setBookOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [bookingDate, setBookingDate] = useState(todayInputValue());
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [booked, setBooked] = useState<{ id: string; date: string; slot: string; service: string } | null>(null);

  const [msgOpen, setMsgOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');

  // Messages go into the provider's chat inbox, like on the store page.
  const sendMessage = useSendProviderMessage({
    mutation: {
      onSuccess: (data) => {
        setMsgOpen(false);
        setMessageDraft('');
        toast({ title: 'Message sent', description: `Chat opened with ${provider?.name ?? 'the provider'}.` });
        navigate(`/messages?c=${data.conversationId}`);
      },
      onError: (error) => {
        toast({ variant: 'destructive', title: 'Message failed', description: error.message });
      },
    },
  });

  const createBooking = useCreateBooking({
    mutation: {
      onSuccess: (booking) => {
        queryClient.invalidateQueries({ queryKey: ['listMyBookings'] });
        setBooked({
          id: booking.id,
          date: new Date(booking.bookingDate).toLocaleDateString(undefined, { dateStyle: 'medium' }),
          slot: booking.timeSlot,
          service: booking.serviceName,
        });
        setNotes('');
      },
      onError: (error) => {
        const message = (error as { data?: { error?: string } } | null)?.data?.error;
        toast({ title: 'Booking failed', description: message ?? 'Please try again.', variant: 'destructive' });
      },
    },
  });

  const defaultAddress = useMemo(() => {
    const list = Array.isArray(addresses) ? addresses : [];
    const preferred = list.find((item) => item.isDefault) ?? list[0];
    return preferred ? `${preferred.line1}, ${preferred.city}` : '';
  }, [addresses]);

  useEffect(() => {
    if (!address && defaultAddress) setAddress(defaultAddress);
  }, [address, defaultAddress]);

  function openBooking(serviceId?: string) {
    if (!user) {
      toast({ title: 'Sign in to book', description: 'You need an account to request a service.' });
      navigate('/sign-in');
      return;
    }
    setSelectedServiceId(serviceId ?? serviceList[0]?.id ?? '');
    setBooked(null);
    setBookOpen(true);
  }

  function handleBook() {
    if (!provider) return;
    if (!selectedServiceId) {
      toast({ title: 'Choose a service', variant: 'destructive' });
      return;
    }
    if (!address.trim()) {
      toast({ title: 'Add your address', description: 'The provider needs to know where to come.', variant: 'destructive' });
      return;
    }
    createBooking.mutate({
      data: {
        providerId: provider.id,
        serviceId: selectedServiceId,
        bookingDate: new Date(`${bookingDate}T09:00:00`).toISOString(),
        timeSlot,
        address: address.trim(),
        notes: notes.trim() || undefined,
      },
    });
  }

  function openMessageDialog() {
    if (!user) {
      navigate('/sign-in');
      return;
    }
    setMsgOpen(true);
  }

  function handleSend() {
    const content = messageDraft.trim();
    if (!content || sendMessage.isPending) return;
    sendMessage.mutate({ providerId: params.id, data: { content } });
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (isError || !provider) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Service provider not found</h1>
        <Link href="/services" className="text-primary hover:underline">Back to all services</Link>
      </div>
    );
  }

  const distance = providerDistance(hasRealLocation ? location : null, provider);
  const averageRating = reviewList.length
    ? reviewList.reduce((sum, review) => sum + review.rating, 0) / reviewList.length
    : provider.rating;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <Link href={provider.category ? `/services/${provider.category}` : '/services'} className="flex items-center text-sm text-primary hover:underline mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          {provider.category ? `Back to ${provider.category}` : 'Back to services'}
        </Link>

        <div className="rounded-xl overflow-hidden aspect-[16/7] w-full mb-6">
          <img
            src={provider.coverUrl || provider.avatarUrl || `https://placehold.co/800x350.png?text=${encodeURIComponent(provider.name)}`}
            alt={provider.name}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h1 className="text-3xl font-headline font-bold">{provider.name}</h1>
              {provider.isVerified && (
                <Badge variant="secondary" className="gap-1">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified
                </Badge>
              )}
              <Badge className={provider.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {provider.isOpen ? 'Open' : 'Closed'}
              </Badge>
            </div>
            {provider.category && <Badge variant="secondary" className="mb-3 capitalize">{provider.category.replace(/_/g, ' ')}</Badge>}
            {provider.description && <p className="text-muted-foreground">{provider.description}</p>}
          </div>
          {averageRating > 0 && (
            <div className="flex items-center gap-1 text-yellow-500 font-semibold text-lg flex-shrink-0">
              <Star className="h-5 w-5 fill-yellow-500" />
              {Number(averageRating).toFixed(1)}
              {reviewList.length > 0 && <span className="text-sm text-muted-foreground font-normal">({reviewList.length})</span>}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Location</p>
              <p className="text-muted-foreground text-sm">{provider.address || 'Service area varies'}</p>
              {typeof distance === 'number' && (
                <p className="text-xs text-primary flex items-center gap-1 mt-1">
                  <Navigation className="h-3 w-3" /> {formatDistance(distance)} away
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-start gap-3">
            <CalendarClock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Availability</p>
              <p className="text-muted-foreground text-sm">{provider.openingHours || 'Contact for availability'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-start gap-3">
            <Phone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Contact</p>
              {provider.phone ? (
                <a href={`tel:${provider.phone}`} className="text-muted-foreground text-sm hover:text-primary">{provider.phone}</a>
              ) : (
                <p className="text-muted-foreground text-sm">Message provider</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" />
            Services
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {servicesLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : serviceList.length === 0 ? (
            <p className="text-muted-foreground text-sm py-2">This provider hasn't listed individual services yet. Send a message to ask for a quote.</p>
          ) : (
            serviceList.map((service) => (
              <div key={service.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">{service.name}</p>
                  {service.description && <p className="text-sm text-muted-foreground">{service.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="outline">{service.priceRange}</Badge>
                    {service.duration && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {service.duration}</span>
                    )}
                  </div>
                </div>
                <Button size="sm" onClick={() => openBooking(service.id)}>
                  Book This
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {reviewList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Star className="h-5 w-5 text-primary" /> Customer Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reviewList.slice(0, 5).map((review) => (
              <div key={review.id} className="flex items-start gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{(review.customerName ?? 'C')[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{review.customerName ?? 'Customer'}</p>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star key={index} className={`h-3.5 w-3.5 ${index < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`} />
                      ))}
                    </div>
                  </div>
                  {review.comment && <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button size="lg" className="flex-1" onClick={() => openBooking()}>
          <CalendarClock className="mr-2 h-5 w-5" />
          Book Now
        </Button>
        <Button size="lg" variant="outline" className="flex-1" onClick={openMessageDialog}>
          <MessageSquare className="mr-2 h-5 w-5" />
          Message Provider
        </Button>
        {provider.phone && (
          <Button size="lg" variant="outline" className="flex-1" asChild>
            <a href={`tel:${provider.phone}`}>
              <Phone className="mr-2 h-5 w-5" />
              Call
            </a>
          </Button>
        )}
      </div>

      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{booked ? 'Booking requested' : `Book ${provider.name}`}</DialogTitle>
            <DialogDescription>
              {booked ? 'The provider will confirm your visit shortly.' : 'Pick a service, date and time that suit you.'}
            </DialogDescription>
          </DialogHeader>

          {booked ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle className="h-14 w-14 text-green-500" />
              <p className="font-semibold">{booked.service}</p>
              <p className="text-sm text-muted-foreground">{booked.date} · {booked.slot}</p>
              <p className="text-xs text-muted-foreground">Booking #{booked.id.slice(0, 8)}</p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" asChild>
                  <Link href="/profile">View My Bookings</Link>
                </Button>
                <Button onClick={() => setBookOpen(false)}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Service</Label>
                {serviceList.length > 0 ? (
                  <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                    <SelectTrigger><SelectValue placeholder="Choose a service" /></SelectTrigger>
                    <SelectContent>
                      {serviceList.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} · {service.priceRange}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">This provider hasn't listed services yet.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="booking-date">Date</Label>
                  <Input
                    id="booking-date"
                    type="date"
                    min={todayInputValue()}
                    value={bookingDate}
                    onChange={(event) => setBookingDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Time slot</Label>
                  <Select value={timeSlot} onValueChange={setTimeSlot}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((slot) => (
                        <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="booking-address">Service address</Label>
                <Input
                  id="booking-address"
                  placeholder="House 12, Street 4, Gulberg III, Lahore"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
                {defaultAddress && address !== defaultAddress && (
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => setAddress(defaultAddress)}>
                    Use saved address: {defaultAddress}
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="booking-notes">Notes (optional)</Label>
                <Textarea
                  id="booking-notes"
                  placeholder="Describe the issue or any special requests."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleBook}
                disabled={createBooking.isPending || serviceList.length === 0}
              >
                {createBooking.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
                Request Booking
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Message {provider.name}
            </DialogTitle>
            <DialogDescription>
              Your message opens a chat with the provider. Their replies appear in Messages.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label htmlFor="msg-body">Message</Label>
            <Textarea
              id="msg-body"
              value={messageDraft}
              onChange={e => setMessageDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Hi ${provider.name}, I'd like to enquire about...`}
              rows={4}
              maxLength={2000}
            />
            <Button className="w-full" onClick={handleSend} disabled={!messageDraft.trim() || sendMessage.isPending}>
              {sendMessage.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
