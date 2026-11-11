import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle, PackageSearch, RefreshCw, Truck } from "lucide-react";

export default function SupportPage() {
  const supportFAQs = [
    {
      question: "How do I track my order?",
      answer: "Go to My Orders in your profile and open the order. Its status updates as the store prepares and delivers it.",
    },
    {
      question: "What is your return policy?",
      answer: "Please refer to our 'Refund Policy' section above for detailed information on returns and refunds. Generally, items can be returned within 7 days if they are in original condition.",
    },
    {
      question: "How long does shipping take?",
      answer: "Shipping times vary depending on your location and the vendor. Estimated delivery times are provided at checkout and can be found in the 'Shipping Information' section.",
    },
    {
      question: "What if I receive a damaged item?",
      answer: "We're sorry to hear that! Please contact our support team immediately with your order number and photos of the damaged item. We'll arrange for a replacement or refund.",
    },
     {
      question: "How can I contact customer support?",
      answer: "You can reach us via the contact details provided on our Contact Us page. For urgent issues, please call us.",
    },
  ];

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl space-y-12">
      <header className="text-center mb-12">
        <HelpCircle className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary">
          Customer Support
        </h1>
        <p className="text-xl text-muted-foreground mt-2">
          We're here to help! Find answers and track your orders.
        </p>
      </header>

      <section id="order-tracking">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <PackageSearch className="h-6 w-6 mr-3 text-primary" />
              Track Your Order
            </CardTitle>
            <CardDescription>Your orders and their live status are in your profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Open any order to see each step as the store updates it, from confirmed to delivered.
            </p>
            <Button asChild className="h-11">
              <Link href="/profile?tab=orders">
                <PackageSearch className="mr-2 h-4 w-4" />
                View My Orders
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section id="refund-policy">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <RefreshCw className="h-6 w-6 mr-3 text-primary" />
              Refund Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground prose dark:prose-invert max-w-none">
            <p>Our goal is to ensure you are completely satisfied with your purchases from Ghar Tak. If you are not satisfied, you may be eligible for a refund or exchange subject to the conditions below.</p>
            <h3 className="font-semibold text-foreground">Eligibility for Refund:</h3>
            <ul>
              <li>Products must be returned within 7 days of receipt.</li>
              <li>Products must be in their original, unopened, and undamaged condition.</li>
              <li>Perishable goods (e.g., fresh food) are generally not eligible for return unless received damaged or spoiled.</li>
              <li>Services once rendered are typically non-refundable, but please contact us if you have issues.</li>
            </ul>
            <h3 className="font-semibold text-foreground">Process:</h3>
            <p>To initiate a refund, please contact our customer support with your order number and reason for return. We may require photographic evidence for damaged goods. Once approved, you will receive instructions on how to return the item. Refunds will be processed to your original payment method within 5-7 business days after we receive and inspect the returned item.</p>
            <p className="text-sm"><em>Ghar Tak reserves the right to amend this policy at any time.</em></p>
          </CardContent>
        </Card>
      </section>

      <section id="shipping-info">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <Truck className="h-6 w-6 mr-3 text-primary" />
              Shipping Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground prose dark:prose-invert max-w-none">
            <p>Ghar Tak aims to deliver your orders as quickly and efficiently as possible. Our hyperlocal model connects you with the nearest vendors and service providers.</p>
            <h3 className="font-semibold text-foreground">Delivery Times:</h3>
            <ul>
              <li><strong>Hyperlocal (Selected Areas):</strong> We aim for a 5-15 minute ETA for products from nearby stores.</li>
              <li><strong>Standard Delivery:</strong> For most products, delivery within Lahore, Karachi, and Islamabad is typically within 1-3 hours. Other cities may take 24-72 hours.</li>
              <li><strong>Services:</strong> Service professional arrival times are confirmed upon booking and depend on their availability.</li>
            </ul>
            <h3 className="font-semibold text-foreground">Shipping Costs:</h3>
            <p>Delivery fees vary based on distance, order size, and urgency. The applicable fee will be clearly displayed at checkout. Some promotions may offer free delivery.</p>
            <h3 className="font-semibold text-foreground">Order Tracking:</h3>
            <p>You can follow every order from My Orders in your profile. Its status changes as the store confirms, prepares and delivers it. Your service bookings show there too, from the moment you request them.</p>
             <p className="text-sm"><em>Please note that delivery times are estimates and can be affected by traffic, weather, or other unforeseen circumstances.</em></p>
          </CardContent>
        </Card>
      </section>

      <section id="faqs">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <HelpCircle className="h-6 w-6 mr-3 text-primary" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {supportFAQs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left hover:no-underline text-lg font-semibold">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground prose dark:prose-invert max-w-none">
                    <p>{faq.answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
