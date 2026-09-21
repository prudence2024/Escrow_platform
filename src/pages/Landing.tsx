import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.svg";
import {
  ShieldCheck,
  Handshake,
  PackageCheck,
  Scale,
  MessageSquareQuote,
  ArrowRight,
  Check,
  Smartphone,
  Lock,
  RefreshCcw,
} from "lucide-react";

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const steps = [
  {
    icon: ShieldCheck,
    title: "Create a protected deal",
    body: "Set the item, price, delivery and inspection terms. Share a secure link with your buyer.",
  },
  {
    icon: Handshake,
    title: "Buyer pays, funds secured",
    body: "Payment is verified with our payment partner. The seller is confirmed but funds aren't released.",
  },
  {
    icon: PackageCheck,
    title: "Deliver with confidence",
    body: "Share delivery details and a one-time code. The buyer inspects the item.",
  },
  {
    icon: Scale,
    title: "Accept or raise a dispute",
    body: "On acceptance, settlement is released to the seller. Any issue opens a fair, evidence-based dispute.",
  },
];

const features = [
  {
    icon: Lock,
    title: "Settlement only after delivery is accepted",
    body: "Sellers get paid once release conditions are met — not before.",
  },
  {
    icon: MessageSquareQuote,
    title: "Real dispute resolution",
    body: "Buyers and sellers exchange messages and evidence, resolved by operations.",
  },
  {
    icon: Smartphone,
    title: "A true mobile app",
    body: "Installable on Android and iOS with an offline-ready shell.",
  },
  {
    icon: RefreshCcw,
    title: "Full timeline & audit",
    body: "Every status change is tracked and visible to both sides.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="No Ojoro" className="size-8 rounded-lg" />
            <span className="font-semibold tracking-tight">No Ojoro</span>
          </Link>
          <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-14 text-center md:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-5 gap-1.5 px-3 py-1">
              <ShieldCheck className="size-3.5" /> Protected transactions, made simple
            </Badge>
            <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
              Pay safe. Sell confident.
              <span className="block text-primary">Every deal protected.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              No Ojoro holds payment safely with our partner until you receive what
              you paid for — then the seller is paid, automatically.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto gap-2">
                <Link to="/auth">
                  Start a protected deal <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link to="/auth">I'm a buyer</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-t border-border/60 bg-card/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2"><Lock className="size-4 text-primary" /> Server-verified payments</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Settlement is conditional</span>
          <span className="inline-flex items-center gap-2"><Scale className="size-4 text-primary" /> Evidence-based disputes</span>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <motion.div {...fade} className="text-center mb-12">
          <p className="text-sm font-medium text-primary">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Both sides win, every time
          </h2>
        </motion.div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              {...fade}
              transition={{ ...fade.transition, delay: i * 0.06 }}
              className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <div className="mb-4 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-5" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Step {i + 1}</p>
              <h3 className="mt-1 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-card/50 border-y border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <motion.div {...fade} className="text-center mb-12">
            <p className="text-sm font-medium text-primary">Built to be trusted</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              For social commerce, done properly
            </h2>
          </motion.div>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                {...fade}
                transition={{ ...fade.transition, delay: i * 0.05 }}
                className="flex gap-4 rounded-2xl border border-border/70 bg-background p-5"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{f.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <motion.div
          {...fade}
          className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground"
        >
          <div className="pointer-events-none absolute -bottom-20 left-1/2 h-64 w-[480px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <h2 className="relative mx-auto max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
            Your next deal, protected from both sides
          </h2>
          <p className="relative mx-auto mt-3 max-w-lg text-primary-foreground/80">
            Create your first protected transaction in under two minutes.
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="relative mt-8 gap-2"
          >
            <Link to="/auth">
              Get started <ArrowRight className="size-4" />
            </Link>
          </Button>
          <div className="relative mt-6 flex items-center justify-center gap-2 text-xs text-primary-foreground/70">
            <Check className="size-3.5" /> No card details stored · No upfront fees right now
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        No Ojoro · protected transactions for social commerce
      </footer>
    </div>
  );
}