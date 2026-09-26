import React from "react";

export default function TrustServiceStrip() {
  const features = [
    { title: "Pan-India Shipping", desc: "Express delivery across 25,000+ pincodes" },
    { title: "Artisan Direct", desc: "Handcrafted by traditional master clusters" },
    { title: "7-Day Replacements", desc: "Hassle-free guarantee on transit damages" },
    { title: "Secure Checkout", desc: "Razorpay 256-bit SSL encrypted payments" }
  ];

  return (
    <div className="bg-ivory border-y border-charcoal/10 py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {features.map((item) => (
          <div key={item.title} className="space-y-1 p-2">
            <p className="font-serif-display text-sm sm:text-base font-bold text-charcoal">{item.title}</p>
            <p className="text-[11px] text-charcoal-soft leading-tight">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
