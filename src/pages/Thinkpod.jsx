import { useState } from "react";
import { SectionHeading, Button, Modal } from "../components/ui";
import SmartImage from "../components/SmartImage";
import { images } from "../data/images";
import { IconPlay } from "../components/icons";

const talks = [
  { id: "rt1", title: "On Everyday Resilience", tag: "Research Talk" },
  { id: "rt2", title: "Understanding Therapeutic Nutrition", tag: "Research Talk" },
  { id: "rt3", title: "The Practice of Listening", tag: "Research Talk" },
];

const insights = [
  { id: "si1", title: "Three Minutes on Mindful Mornings", tag: "Short Insight" },
  { id: "si2", title: "A Quick Note on Boundaries", tag: "Short Insight" },
];

export default function Thinkpod() {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  return (
    <div>
      <section className="bg-green py-20 text-center text-ivory">
        <div className="mx-auto max-w-2xl px-5 sm:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-terracotta-light">
            Research Thinkpod
          </p>
          <h1 className="mt-4 font-serif-display text-3xl sm:text-4xl">Research Thinkpod</h1>
          <p className="mt-4 text-ivory/70">
            Ideas, research and meaningful conversations with Dr. Aqsa.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <SectionHeading eyebrow="Featured" title="Featured Conversation" />
        <button
          onClick={() => setShowVideoModal(true)}
          className="group relative mt-8 block w-full"
        >
          <SmartImage image={images.thinkpod.featured} tone="charcoal" ratio="aspect-video" priority />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ivory/90 text-green-deep shadow-xl transition group-hover:scale-105">
              <IconPlay />
            </div>
          </div>
        </button>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-4 sm:px-8">
        <SectionHeading eyebrow="Conversations" title="Research Talks" />
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {talks.map((t) => (
            <button key={t.id} onClick={() => setShowVideoModal(true)} className="group text-left">
              <div className="relative">
                <SmartImage image={images.thinkpod.talk} tone="sage" ratio="aspect-video" label={t.tag} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ivory/90 text-green-deep transition group-hover:scale-105">
                    <IconPlay />
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium text-charcoal">{t.title}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <SectionHeading eyebrow="Quick Reads" title="Short Insights" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {insights.map((s) => (
            <button
              key={s.id}
              onClick={() => setShowVideoModal(true)}
              className="flex items-center gap-4 rounded-2xl border border-charcoal/10 bg-white/50 p-4 text-left transition hover:shadow-md"
            >
              <SmartImage image={images.thinkpod.insight} tone="beige" ratio="aspect-square" className="w-20 shrink-0" />
              <p className="text-sm font-medium text-charcoal">{s.title}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-ivory-dark py-16">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <SectionHeading
            eyebrow="Follow Along"
            title="YouTube & Instagram Resources"
            align="center"
            className="mx-auto"
          />
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button variant="secondary" onClick={() => setShowLinkModal(true)}>
              YouTube Channel
            </Button>
            <Button variant="secondary" onClick={() => setShowLinkModal(true)}>
              Instagram Page
            </Button>
          </div>
        </div>
      </section>

      <Modal open={showLinkModal} onClose={() => setShowLinkModal(false)} title="Coming Soon">
        <p className="text-sm leading-relaxed text-charcoal-soft">
          Link will be connected with official resource.
        </p>
      </Modal>

      <Modal open={showVideoModal} onClose={() => setShowVideoModal(false)} title="Video Preview">
        <SmartImage image={images.thinkpod.featured} tone="charcoal" ratio="aspect-video" />
        <p className="mt-4 text-sm leading-relaxed text-charcoal-soft">
          Link will be connected with official resource.
        </p>
      </Modal>
    </div>
  );
}
