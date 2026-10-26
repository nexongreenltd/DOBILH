/* eslint-disable no-console */
import { PrismaClient, type CourseMode, type CourseLevel, type MaterialType, type AttendanceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { promises as fs } from "fs";
import path from "path";

const db = new PrismaClient();
const PASSWORD = "Password@123";

// Deterministic PRNG so the demo data is stable between resets.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;

const DAY = 86400000;
const now = new Date();
const startOfToday = new Date(now);
startOfToday.setHours(0, 0, 0, 0);
const at = (dayOffset: number, hour: number, minute = 0) => {
  const d = new Date(startOfToday.getTime() + dayOffset * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
};

function minimalPdf(title: string, lines: string[]) {
  const text = [title, "", ...lines].map((l, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 60 ${740 - i * 22} Td (${l.replace(/[()\\]/g, "")}) Tj ET`).join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

const STORAGE = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage", "uploads"));

async function storePdf(name: string, title: string, lines: string[], uploadedById: string) {
  const key = `seed/${name}`;
  const buf = minimalPdf(title, lines);
  await fs.mkdir(path.join(STORAGE, "seed"), { recursive: true });
  await fs.writeFile(path.join(STORAGE, key), buf);
  return db.storedFile.create({ data: { key, originalName: name, mimeType: "application/pdf", size: buf.length, uploadedById } });
}

type CourseSeed = {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  category: string;
  level: CourseLevel;
  mode: CourseMode;
  price: number;
  salePrice?: number;
  weeks: number;
  hue: number;
  featured?: boolean;
  outcomes: string[];
  requirements: string[];
  lessons: string[];
  venue?: string;
};

const COURSES: CourseSeed[] = [
  {
    title: "Full-Stack Web Development with Next.js",
    slug: "full-stack-web-development-nextjs",
    subtitle: "Build and ship production web apps with React, Next.js, Node.js and PostgreSQL.",
    description:
      "A project-driven programme that takes you from modern JavaScript to deploying a full-stack application. You'll learn React and Next.js, design REST APIs in Node.js, model data in PostgreSQL, and ship to the cloud with authentication, testing and CI. Weekend sessions run at the DoB Innovation Lab in Dhaka with live online streaming for remote learners.",
    category: "Technology & AI",
    level: "INTERMEDIATE",
    mode: "HYBRID",
    price: 18000,
    salePrice: 14500,
    weeks: 12,
    hue: 160,
    featured: true,
    venue: "DoB Innovation Lab, Dhanmondi, Dhaka",
    outcomes: [
      "Build responsive interfaces with React and Next.js App Router",
      "Design and secure REST APIs with Node.js",
      "Model relational data in PostgreSQL with Prisma",
      "Deploy, monitor and iterate on a production app",
    ],
    requirements: ["Basic HTML, CSS and JavaScript", "A laptop with 8 GB RAM", "Commitment of ~8 hours per week"],
    lessons: [
      "Modern JavaScript refresher",
      "React fundamentals: components, props & state",
      "Next.js App Router & server components",
      "Styling systems with Tailwind CSS",
      "Node.js APIs & validation",
      "PostgreSQL data modelling",
      "Authentication & role-based access",
      "Testing and quality",
      "Deployment & observability",
      "Capstone project sprint",
    ],
  },
  {
    title: "Applied AI & Machine Learning for Beginners",
    slug: "applied-ai-machine-learning",
    subtitle: "Understand and apply machine learning and generative AI to real problems.",
    description:
      "Demystify AI with hands-on notebooks. Starting from Python and data handling, you'll train classic ML models, evaluate them honestly, and then build practical generative-AI tools with modern LLM APIs — with a strong focus on responsible use in the Bangladeshi context.",
    category: "Technology & AI",
    level: "BEGINNER",
    mode: "ONLINE",
    price: 9500,
    weeks: 8,
    hue: 265,
    featured: true,
    outcomes: ["Prepare datasets with pandas", "Train and evaluate ML models", "Prompt and integrate LLMs", "Reason about AI ethics and bias"],
    requirements: ["Comfort with basic algebra", "No prior coding experience needed"],
    lessons: [
      "What AI is — and isn't",
      "Python for data in one week",
      "Supervised learning in practice",
      "Model evaluation & overfitting",
      "Intro to neural networks",
      "Working with LLM APIs",
      "Building an AI assistant",
      "Responsible AI",
    ],
  },
  {
    title: "Data Analytics with Python & Power BI",
    slug: "data-analytics-python-power-bi",
    subtitle: "Turn raw data into dashboards and decisions.",
    description:
      "Learn the full analytics workflow: cleaning data with Python, asking the right questions, building interactive dashboards in Power BI and presenting insights stakeholders act on.",
    category: "Data Science",
    level: "BEGINNER",
    mode: "ONLINE",
    price: 8000,
    salePrice: 6500,
    weeks: 8,
    hue: 200,
    featured: true,
    outcomes: ["Clean and reshape data", "Write analytical SQL", "Design Power BI dashboards", "Tell stories with data"],
    requirements: ["Windows laptop for Power BI Desktop", "Spreadsheet basics"],
    lessons: ["The analytics mindset", "Spreadsheets to Python", "Cleaning messy data", "SQL for analysts", "Power BI essentials", "Dashboard design", "Data storytelling"],
  },
  {
    title: "Entrepreneurship Bootcamp: Idea to Startup",
    slug: "entrepreneurship-bootcamp",
    subtitle: "Validate an idea, build an MVP and pitch to investors in 6 weeks.",
    description:
      "An intensive in-person bootcamp for founders. Through workshops, mentor clinics and peer critique you will validate a problem, design a lean business model, prototype your MVP and deliver an investor-ready pitch at Demo Day.",
    category: "Business & Entrepreneurship",
    level: "BEGINNER",
    mode: "OFFLINE",
    price: 7500,
    weeks: 6,
    hue: 25,
    featured: true,
    venue: "DoB Innovation Hub, Banani, Dhaka",
    outcomes: ["Validate problems with customer interviews", "Build a lean canvas", "Prototype an MVP", "Pitch with confidence"],
    requirements: ["An idea or a problem you care about"],
    lessons: ["Founder mindset", "Customer discovery", "Lean business model", "MVP & prototyping", "Go-to-market", "Pitch clinic"],
  },
  {
    title: "UI/UX Design Fundamentals",
    slug: "ui-ux-design-fundamentals",
    subtitle: "Research, wireframe and prototype delightful digital products in Figma.",
    description:
      "Learn the design process end to end — user research, information architecture, wireframing, visual design and usability testing — by redesigning a real product used in Bangladesh.",
    category: "Design & Creative",
    level: "BEGINNER",
    mode: "HYBRID",
    price: 8500,
    salePrice: 6900,
    weeks: 8,
    hue: 320,
    venue: "DoB Innovation Lab, Dhanmondi, Dhaka",
    outcomes: ["Run user interviews", "Wireframe and prototype in Figma", "Apply visual design principles", "Run usability tests"],
    requirements: ["A free Figma account"],
    lessons: ["Design thinking", "User research", "Information architecture", "Wireframing", "Visual design", "Prototyping", "Usability testing"],
  },
  {
    title: "Digital Marketing Mastery",
    slug: "digital-marketing-mastery",
    subtitle: "Grow brands with content, social, search and performance marketing.",
    description: "Plan and run campaigns across Facebook, Google and content channels, measure what matters and optimise spend for local businesses.",
    category: "Business & Entrepreneurship",
    level: "INTERMEDIATE",
    mode: "ONLINE",
    price: 6000,
    weeks: 6,
    hue: 45,
    outcomes: ["Plan a content strategy", "Run paid social campaigns", "Fundamentals of SEO", "Measure with analytics"],
    requirements: ["Basic familiarity with social media"],
    lessons: ["Marketing foundations", "Content strategy", "Social media ads", "Search & SEO", "Analytics & attribution", "Campaign lab"],
  },
  {
    title: "Career Readiness & Professional Communication",
    slug: "career-readiness-professional-communication",
    subtitle: "Free course: CVs, interviews, workplace writing and presentation skills.",
    description:
      "A free foundation course open to every learner. Build a strong CV and LinkedIn profile, practise interviews, write clear professional emails and present with confidence.",
    category: "Career Skills",
    level: "BEGINNER",
    mode: "ONLINE",
    price: 0,
    weeks: 4,
    hue: 140,
    featured: true,
    outcomes: ["Write a standout CV", "Ace structured interviews", "Write clear workplace emails", "Present with confidence"],
    requirements: ["None — open to all"],
    lessons: ["Know your strengths", "CV & LinkedIn", "Interview practice", "Workplace writing", "Presenting with confidence"],
  },
  {
    title: "Spoken English for Professionals",
    slug: "spoken-english-professionals",
    subtitle: "Speak fluently and confidently in meetings, interviews and presentations.",
    description: "Small-group, in-person conversation practice focused on workplace scenarios, pronunciation and confidence.",
    category: "Language",
    level: "BEGINNER",
    mode: "OFFLINE",
    price: 4500,
    weeks: 8,
    hue: 185,
    venue: "DoB Learning Centre, Mirpur, Dhaka",
    outcomes: ["Hold workplace conversations", "Improve pronunciation", "Participate in meetings", "Interview in English"],
    requirements: ["Basic reading ability in English"],
    lessons: ["Introductions & small talk", "Pronunciation clinic", "Meetings & opinions", "Phone & video calls", "Interview English", "Presentations"],
  },
];

async function main() {
  console.log("Resetting data…");
  // Order matters for FK constraints.
  await db.$transaction([
    db.aiMessage.deleteMany(), db.aiConversation.deleteMany(), db.aiKnowledge.deleteMany(),
    db.notification.deleteMany(), db.announcement.deleteMany(), db.auditLog.deleteMany(),
    db.certificate.deleteMany(), db.couponUsage.deleteMany(), db.payment.deleteMany(), db.coupon.deleteMany(),
    db.submission.deleteMany(), db.questionOption.deleteMany(), db.question.deleteMany(), db.assessment.deleteMany(),
    db.attendance.deleteMany(), db.classSession.deleteMany(), db.lessonProgress.deleteMany(), db.material.deleteMany(),
    db.lesson.deleteMany(), db.enrollment.deleteMany(), db.batch.deleteMany(), db.courseInstructor.deleteMany(),
    db.course.deleteMany(), db.category.deleteMany(), db.storedFile.deleteMany(), db.user.deleteMany(), db.setting.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const mkUser = (name: string, email: string, role: "STUDENT" | "INSTRUCTOR" | "ADMIN" | "SUPER_ADMIN", extra: Record<string, string> = {}) =>
    db.user.create({
      data: { name, email, role, passwordHash, avatarColor: pick(["#006a4e", "#0e7490", "#7c3aed", "#c2410c", "#be123c", "#1d4ed8", "#a16207"]), ...extra },
    });

  console.log("Users…");
  const superAdmin = await mkUser("Farhana Rahman", "superadmin@dob.org", "SUPER_ADMIN", { headline: "Director, DoB Innovation & Learning Hub" });
  const admin = await mkUser("Tanvir Ahmed", "admin@dob.org", "ADMIN", { headline: "Programme Operations Lead" });
  const instructors = await Promise.all([
    mkUser("Dr. Nusrat Jahan", "nusrat@dob.org", "INSTRUCTOR", { headline: "AI researcher & educator", bio: "PhD in Machine Learning, 10+ years teaching data and AI." }),
    mkUser("Arif Hossain", "arif@dob.org", "INSTRUCTOR", { headline: "Senior Software Engineer", bio: "Builds large-scale web platforms; mentor to 500+ developers." }),
    mkUser("Sadia Islam", "sadia@dob.org", "INSTRUCTOR", { headline: "Product Designer & Founder", bio: "Founder of two startups and a design lead for fintech products." }),
    mkUser("Kamal Uddin", "kamal@dob.org", "INSTRUCTOR", { headline: "Growth Marketer & Communication Coach" }),
  ]);
  const studentNames = [
    "Rahim Chowdhury", "Ayesha Siddiqua", "Imran Kabir", "Mehjabin Akter", "Shafiq Hasan", "Tasnim Ferdous", "Nafis Iqbal", "Raisa Haque",
    "Sabbir Rahman", "Lamia Sultana", "Zubair Alam", "Fariha Noor", "Mahin Talukder", "Jannat Ara", "Rifat Mahmud", "Nabila Karim",
    "Tahmid Anwar", "Sumaiya Begum", "Asif Mridha", "Orpita Das", "Shuvo Saha", "Maliha Tabassum", "Ehsan Ullah", "Priya Barua",
  ];
  const students = [];
  for (const [i, name] of studentNames.entries()) {
    const email = i === 0 ? "student@dob.org" : `${name.split(" ")[0]!.toLowerCase()}@example.com`;
    students.push(await mkUser(name, email, "STUDENT", { phone: `017${String(10000000 + i * 7919).slice(0, 8)}` }));
  }
  const demoStudent = students[0]!;

  console.log("Settings & categories…");
  await db.setting.createMany({
    data: [
      { key: "aiEnabled", value: true },
      { key: "aiGenerative", value: true },
      { key: "allowSelfRegistration", value: true },
      { key: "certificateSignatory", value: "Farhana Rahman" },
      { key: "certificateSignatoryTitle", value: "Director, DoB Innovation & Learning Hub" },
    ],
  });
  const categoryIcons: Record<string, string> = {
    "Technology & AI": "cpu",
    "Data Science": "bar-chart",
    "Business & Entrepreneurship": "rocket",
    "Design & Creative": "palette",
    "Career Skills": "briefcase",
    Language: "languages",
  };
  const categories: Record<string, string> = {};
  for (const [name, icon] of Object.entries(categoryIcons)) {
    const c = await db.category.create({ data: { name, icon, slug: name.toLowerCase().replace(/[^a-z]+/g, "-") } });
    categories[name] = c.id;
  }

  const instructorFor: Record<string, number[]> = {
    "full-stack-web-development-nextjs": [1, 0],
    "applied-ai-machine-learning": [0],
    "data-analytics-python-power-bi": [0],
    "entrepreneurship-bootcamp": [2],
    "ui-ux-design-fundamentals": [2],
    "digital-marketing-mastery": [3],
    "career-readiness-professional-communication": [3],
    "spoken-english-professionals": [3],
  };

  let batchCounter = 1;
  for (const [ci, c] of COURSES.entries()) {
    console.log(`Course: ${c.title}`);
    const course = await db.course.create({
      data: {
        title: c.title, slug: c.slug, subtitle: c.subtitle, description: c.description, categoryId: categories[c.category], level: c.level, mode: c.mode,
        price: c.price, salePrice: c.salePrice ?? null, durationWeeks: c.weeks, coverHue: c.hue, featured: !!c.featured, outcomes: c.outcomes,
        requirements: c.requirements, status: "PUBLISHED", certMinProgress: 80, certMinAttendance: 70,
      },
    });
    const teacherIdx = instructorFor[c.slug]!;
    for (const [k, idx] of teacherIdx.entries()) {
      await db.courseInstructor.create({ data: { courseId: course.id, userId: instructors[idx]!.id, isLead: k === 0 } });
    }
    const lead = instructors[teacherIdx[0]!]!;

    // Lessons: roughly 60% released (daily cadence), the rest scheduled.
    const released = Math.ceil(c.lessons.length * 0.6);
    const lessons = [];
    for (const [li, title] of c.lessons.entries()) {
      const lesson = await db.lesson.create({
        data: {
          courseId: course.id, title, orderNo: li + 1, durationMin: 30 + Math.round(rand() * 60), isPreview: li === 0,
          summary: `Day ${li + 1}: ${title.toLowerCase()} — concepts, worked examples and a hands-on exercise.`,
          publishAt: li < released ? at(-(released - li) * 3, 9) : at((li - released + 1) * 3, 9),
        },
      });
      lessons.push(lesson);
      const pdf = await storePdf(`${c.slug}-lesson-${li + 1}-notes.pdf`, `${title} — Daily Notes`, [
        `Course: ${c.title}`, `Lesson ${li + 1}`, "Key ideas, worked examples and practice questions.", "DoB Innovation & Learning Hub",
      ], lead.id);
      const mats: { type: MaterialType; title: string; url?: string; fileId?: string }[] = [
        { type: "VIDEO", title: `Recorded lecture: ${title}`, url: "https://www.youtube.com/embed/ysz5S6PUM-U" },
        { type: "PDF", title: "Daily notes (PDF)", fileId: pdf.id },
        { type: "SLIDE", title: "Presentation slides", url: "https://docs.google.com/presentation/d/1EAYk18WDjIG-zp_0vLm3CsfQh_i8eXc67Jo2O9C6Vuc/embed" },
      ];
      if (li % 3 === 0) mats.push({ type: "LINK", title: "Further reading", url: "https://developer.mozilla.org/" });
      for (const [mi, m] of mats.entries()) {
        await db.material.create({ data: { lessonId: lesson.id, orderNo: mi, visibility: li === 0 ? "PUBLIC" : "ENROLLED", ...m } });
      }
    }

    // Batches: one running (started ~3 weeks ago), one upcoming.
    const runningStart = at(-21 - ci, 0);
    const running = await db.batch.create({
      data: {
        courseId: course.id, name: `Batch ${String(batchCounter).padStart(2, "0")} — ${runningStart.toLocaleString("en", { month: "long", year: "numeric" })}`,
        code: `${c.slug.split("-").map((w) => w[0]).join("").toUpperCase()}-${String(batchCounter++).padStart(3, "0")}`, mode: c.mode,
        startDate: runningStart, endDate: new Date(runningStart.getTime() + c.weeks * 7 * DAY),
        scheduleText: c.mode === "OFFLINE" ? "Fri & Sat, 10:00 AM – 1:00 PM" : c.mode === "HYBRID" ? "Sat (in person) & Tue (online), 7:00 – 9:00 PM" : "Sun & Wed, 8:00 – 9:30 PM",
        venue: c.venue ?? null, capacity: c.mode === "OFFLINE" ? 30 : 60, status: "RUNNING",
      },
    });
    const upcomingStart = at(10 + ci * 2, 0);
    await db.batch.create({
      data: {
        courseId: course.id, name: `Batch ${String(batchCounter).padStart(2, "0")} — ${upcomingStart.toLocaleString("en", { month: "long", year: "numeric" })}`,
        code: `${c.slug.split("-").map((w) => w[0]).join("").toUpperCase()}-${String(batchCounter++).padStart(3, "0")}`, mode: c.mode,
        startDate: upcomingStart, endDate: new Date(upcomingStart.getTime() + c.weeks * 7 * DAY), scheduleText: "Schedule announced at orientation",
        venue: c.venue ?? null, capacity: 40, status: "UPCOMING",
      },
    });

    // Sessions: past twice-weekly sessions + a few upcoming (one today for demo).
    const sessions = [];
    const offsets = [-19, -16, -12, -9, -5, -2, 0, 3, 6, 10];
    for (const [si, off] of offsets.entries()) {
      const mode: CourseMode = c.mode === "HYBRID" ? (si % 2 === 0 ? "OFFLINE" : "ONLINE") : c.mode;
      const startsAt = off === 0 ? new Date(now.getTime() + 2 * 3600000) : at(off, c.mode === "OFFLINE" ? 10 : 20);
      const lesson = lessons[Math.min(si, lessons.length - 1)]!;
      sessions.push(
        await db.classSession.create({
          data: {
            batchId: running.id, lessonId: lesson.id, title: `Class ${si + 1}: ${lesson.title}`, mode, startsAt,
            endsAt: new Date(startsAt.getTime() + 2 * 3600000),
            // Upcoming online classes run on DoB Live (in-app); past ones used an external link.
            hosting: mode === "ONLINE" && off >= 0 ? "PLATFORM" : "EXTERNAL",
            liveUrl: mode === "ONLINE" && off < 0 ? "https://meet.google.com/dob-learn-hub" : null,
            venue: mode === "OFFLINE" ? (c.venue ?? "DoB Innovation Lab") : null,
            status: off < 0 ? "COMPLETED" : "SCHEDULED",
            recordingUrl: off < 0 && mode === "ONLINE" ? "https://www.youtube.com/embed/ysz5S6PUM-U" : null,
          },
        }),
      );
    }

    // Assessments
    const quiz = await db.assessment.create({
      data: {
        courseId: course.id, type: "QUIZ", title: `Quiz 1: ${c.lessons[0]} & ${c.lessons[1]}`, instructions: "Answer all questions. Single attempt; auto-graded.",
        totalMarks: 10, passMarks: 6, dueAt: at(-6, 23, 59), durationMin: 20, status: "PUBLISHED", resultsPublished: true, createdById: lead.id,
      },
    });
    const quiz2 = await db.assessment.create({
      data: {
        courseId: course.id, type: "QUIZ", title: `Quiz 2: ${c.lessons[2]}`, instructions: "Two attempts allowed — your best score counts.",
        totalMarks: 10, passMarks: 6, dueAt: at(5, 23, 59), durationMin: 15, maxAttempts: 2, status: "PUBLISHED", resultsPublished: true, createdById: lead.id,
      },
    });
    const assignment = await db.assessment.create({
      data: {
        courseId: course.id, batchId: running.id, type: "ASSIGNMENT", title: `Assignment: apply ${c.lessons[1]!.toLowerCase()}`,
        instructions: "Write a short report (300–500 words) or upload a PDF demonstrating what you've learned. Include at least one real-world example from Bangladesh.",
        totalMarks: 20, passMarks: 10, dueAt: at(-3, 23, 59), status: "PUBLISHED", resultsPublished: true, createdById: lead.id,
      },
    });
    await db.assessment.create({
      data: {
        courseId: course.id, type: "EXAM", title: "Final exam", instructions: "Comprehensive written exam covering the whole course.",
        totalMarks: 50, passMarks: 25, dueAt: at(c.weeks * 7 - 21, 12), status: "DRAFT", createdById: lead.id,
      },
    });

    const qBank = [
      { p: `Which statement best describes the goal of "${c.lessons[0]}"?`, o: ["Building a strong foundation for the course", "Skipping fundamentals", "Memorising definitions only", "None of the above"], a: [0] },
      { p: `True or false: practice exercises are part of every lesson in ${c.title}.`, t: "TF", o: ["True", "False"], a: [0] },
      { p: "Which of these are good learning habits? (Select all that apply)", m: true, o: ["Reviewing daily notes", "Asking questions in class", "Skipping assignments", "Practising regularly"], a: [0, 1, 3] },
      { p: `In ${c.lessons[1]}, what is the recommended first step?`, o: ["Understand the problem", "Jump to the solution", "Ignore requirements", "Copy a template"], a: [0] },
      { p: "Which DoB resource is published after each class?", o: ["Daily PDF notes and slides", "Nothing", "Only exam papers", "Random videos"], a: [0] },
    ];
    for (const a of [quiz, quiz2]) {
      for (const [qi, q] of qBank.entries()) {
        const question = await db.question.create({
          data: {
            assessmentId: a.id, prompt: q.p, marks: 2, orderNo: qi,
            type: q.t === "TF" ? "TRUE_FALSE" : q.m ? "MULTI_CHOICE" : "SINGLE_CHOICE",
            explanation: "Review the daily notes for this lesson for a full explanation.",
          },
        });
        await db.questionOption.createMany({ data: q.o.map((text, oi) => ({ questionId: question.id, text, orderNo: oi, isCorrect: q.a.includes(oi) })) });
      }
    }

    // Enrollments
    const pool = ci === 0 ? students.slice(0, 18) : students.filter(() => rand() < 0.45);
    if (ci < 4 && !pool.includes(demoStudent)) pool.unshift(demoStudent);
    const coupon = ci === 0 ? await db.coupon.create({ data: { code: "WELCOME20", description: "20% off for new learners", discountType: "PERCENT", discountValue: 20, maxUses: 200, perUserLimit: 1, validUntil: at(60, 23) } }) : null;

    for (const [si, s] of pool.entries()) {
      const enrolledAt = new Date(runningStart.getTime() - (3 + si) * DAY);
      const enrollment = await db.enrollment.create({ data: { userId: s.id, courseId: course.id, batchId: running.id, status: "ACTIVE", enrolledAt } });
      const original = c.salePrice ?? c.price;
      const useCoupon = coupon && si % 4 === 1;
      const discount = useCoupon ? Math.round(original * 0.2) : 0;
      const payment = await db.payment.create({
        data: {
          invoiceNo: `INV-${enrolledAt.toISOString().slice(0, 10).replace(/-/g, "")}-${(ci * 100 + si).toString(16).toUpperCase().padStart(4, "0")}`,
          enrollmentId: enrollment.id, userId: s.id, originalAmount: original, discount, amount: original - discount,
          method: original === 0 ? "FREE" : pick(["BKASH", "BKASH", "NAGAD", "CARD", "ROCKET"]), gateway: original === 0 ? "free" : "sandbox",
          gatewayRef: original === 0 ? null : `TRX${Math.floor(rand() * 1e10)}`, status: "PAID", paidAt: enrolledAt, createdAt: enrolledAt,
          couponId: useCoupon ? coupon!.id : null,
        },
      });
      if (useCoupon) {
        await db.couponUsage.create({ data: { couponId: coupon!.id, userId: s.id, paymentId: payment.id, usedAt: enrolledAt } });
        await db.coupon.update({ where: { id: coupon!.id }, data: { usedCount: { increment: 1 } } });
      }

      // Attendance on past sessions
      const diligence = s.id === demoStudent.id ? 0.92 : 0.55 + rand() * 0.45;
      for (const sess of sessions.filter((x) => x.status === "COMPLETED")) {
        const r = rand();
        const status: AttendanceStatus = r < diligence ? (r < diligence - 0.08 ? "PRESENT" : "LATE") : r < diligence + 0.05 ? "EXCUSED" : "ABSENT";
        await db.attendance.create({ data: { sessionId: sess.id, studentId: s.id, status, markedById: lead.id, markedAt: sess.endsAt } });
      }

      // Lesson progress
      const releasedLessons = lessons.filter((l) => l.publishAt && l.publishAt <= now);
      const done = Math.round(releasedLessons.length * (s.id === demoStudent.id ? 0.75 : diligence));
      for (const [li, l] of releasedLessons.entries()) {
        if (li < done) await db.lessonProgress.create({ data: { studentId: s.id, lessonId: l.id, completionPct: 100, completedAt: new Date(l.publishAt!.getTime() + DAY), lastViewedAt: new Date(l.publishAt!.getTime() + DAY) } });
        else if (li === done) await db.lessonProgress.create({ data: { studentId: s.id, lessonId: l.id, completionPct: 40, lastViewedAt: new Date(now.getTime() - DAY) } });
      }

      // Quiz 1 attempts (auto-graded)
      if (rand() < 0.9) {
        const obtained = Math.min(10, 2 * Math.round(2 + diligence * 3 + rand() * 1.5));
        await db.submission.create({
          data: {
            assessmentId: quiz.id, studentId: s.id, attemptNo: 1, status: "GRADED", answers: {}, startedAt: at(-8, 21), submittedAt: at(-8, 21, 15),
            autoScore: obtained, obtained, gradedAt: at(-8, 21, 15), feedback: obtained >= 8 ? "Excellent work!" : obtained >= 6 ? "Good — review the notes on weaker areas." : "Please revisit lessons 1–2 and reach out during office hours.",
          },
        });
      }
      // Assignment submissions — some graded, some awaiting grading
      if (rand() < 0.8) {
        const graded = rand() < 0.6;
        const obtained = graded ? Math.round(10 + diligence * 8 + rand() * 2) : null;
        await db.submission.create({
          data: {
            assessmentId: assignment.id, studentId: s.id, attemptNo: 1, status: graded ? "GRADED" : "SUBMITTED",
            textAnswer: `In this assignment I applied ${c.lessons[1]!.toLowerCase()} to a local example from Dhaka. I identified the core problem, explored two approaches and reflected on trade-offs…`,
            startedAt: at(-5, 19), submittedAt: at(-4, 22), obtained, gradedById: graded ? lead.id : null, gradedAt: graded ? at(-2, 11) : null,
            feedback: graded ? pick(["Well structured and thoughtful.", "Good analysis — add more evidence next time.", "Strong local example. Great job!"]) : null,
          },
        });
      }
    }

    // Course-level knowledge for the AI assistant
    await db.aiKnowledge.createMany({
      data: [
        {
          courseId: course.id, question: `What will I learn in ${c.title}?`,
          answer: `${c.title} covers: ${c.outcomes.join("; ")}. It runs for ${c.weeks} weeks (${c.mode.toLowerCase()}).`,
          keywords: ["learn", "syllabus", "curriculum", "outcomes", "topics", c.title.split(" ")[0]!.toLowerCase()],
        },
        {
          courseId: course.id, question: `What do I need before starting ${c.title}?`, answer: `Requirements: ${c.requirements.join("; ")}.`,
          keywords: ["requirements", "prerequisites", "need", "laptop", "before"],
        },
      ],
    });

    await db.announcement.create({
      data: {
        authorId: lead.id, courseId: course.id, batchId: running.id, title: "Welcome to the batch!",
        body: "Daily notes and slides are published after each class. Please complete Quiz 2 before the deadline and bring questions to the next session.",
        createdAt: at(-18, 10),
      },
    });
  }

  // Extra coupons
  await db.coupon.createMany({
    data: [
      { code: "DOB500", description: "৳500 off any paid course", discountType: "FIXED", discountValue: 500, maxUses: 100, perUserLimit: 1, validUntil: at(30, 23) },
      { code: "EARLYBIRD", description: "15% early-bird discount (expired)", discountType: "PERCENT", discountValue: 15, validUntil: at(-10, 23), active: true },
    ],
  });

  // One pending (unpaid) enrollment for the demo student, on a paid course they haven't joined.
  const pendingCourse = await db.course.findFirst({
    where: { price: { gt: 0 }, enrollments: { none: { userId: demoStudent.id } } },
    include: { batches: true },
    orderBy: { price: "asc" },
  });
  if (pendingCourse) {
    const e = await db.enrollment.create({ data: { userId: demoStudent.id, courseId: pendingCourse.id, batchId: pendingCourse.batches[0]!.id, status: "PENDING" } });
    await db.payment.create({
      data: { invoiceNo: "INV-PENDING-0001", enrollmentId: e.id, userId: demoStudent.id, originalAmount: pendingCourse.price, amount: pendingCourse.salePrice ?? pendingCourse.price, method: "BKASH", status: "PENDING" },
    });
  }

  // Certificates: a couple of high performers in the first course have completed.
  const firstCourse = await db.course.findUniqueOrThrow({ where: { slug: COURSES[6]!.slug } });
  const certStudents = await db.enrollment.findMany({ where: { courseId: firstCourse.id }, take: 3 });
  for (const [i, e] of certStudents.entries()) {
    await db.enrollment.update({ where: { id: e.id }, data: { status: "COMPLETED", completedAt: at(-2, 12) } });
    await db.certificate.create({ data: { certificateNo: `DOB-${now.getFullYear()}-C${(1000 + i * 37).toString(36).toUpperCase()}`, enrollmentId: e.id, userId: e.userId, courseId: e.courseId, finalScore: 84 + i * 4, issuedAt: at(-2, 12) } });
  }

  // Platform FAQs for the AI assistant
  console.log("AI knowledge…");
  await db.aiKnowledge.createMany({
    data: [
      { question: "How do I pay for a course?", answer: "Open the course page, choose a batch and click Enroll. You can pay with bKash, Nagad, Rocket or card. Your enrollment is confirmed as soon as the payment is verified, and the course appears in My courses.", keywords: ["pay", "payment", "bkash", "nagad", "card", "enroll", "fee", "purchase"] },
      { question: "Can I get a refund?", answer: "Refund requests are accepted within 7 days of enrollment if you have attended no more than two classes. Email the support team with your invoice number and the admin team will review it.", keywords: ["refund", "money back", "cancel", "cancellation"] },
      { question: "How do I get my certificate?", answer: "Certificates are issued automatically when you meet the course rules — usually completing 80% of lessons, attending at least 70% of classes and passing every published assessment. Check Certificates in your dashboard to see your eligibility progress and claim it once eligible.", keywords: ["certificate", "certification", "complete", "completion", "eligible"] },
      { question: "How is attendance counted?", answer: "Instructors mark attendance for every class — in person for offline sessions and from the live session for online classes. Present, late and excused all count toward your attendance percentage; absent does not.", keywords: ["attendance", "absent", "present", "late", "class", "missed"] },
      { question: "Where can I find class notes and slides?", answer: "Open My courses, choose the course and select a lesson. Daily PDF notes, slides and recorded videos are attached to each lesson once your instructor publishes them.", keywords: ["notes", "pdf", "slides", "materials", "resources", "recording", "video", "lecture"] },
      { question: "How do I join a live online class?", answer: "Go to Schedule in your dashboard. Online classes show a Join button that opens the live link around class time. Offline classes show the venue and room.", keywords: ["join", "live", "online", "class", "link", "zoom", "meet", "schedule"] },
      { question: "When will I see my marks?", answer: "Quizzes are auto-graded and show your score as soon as results are published. Assignments and exams are graded by your instructor — you'll get a notification with marks and feedback once they're released.", keywords: ["marks", "grade", "result", "score", "feedback"] },
      { question: "I missed a quiz deadline. What can I do?", answer: "Quizzes close at their deadline. If you had a genuine reason (illness, emergency), message your instructor through the course announcements or contact support — they may reopen the attempt at their discretion.", keywords: ["missed", "deadline", "late", "quiz", "extension"] },
      { question: "How many attempts do I get on a quiz?", answer: "Each quiz shows its attempt limit on the start page. When more than one attempt is allowed, your best score counts.", keywords: ["attempts", "retake", "quiz", "try again"] },
      { question: "Can I switch to a different batch?", answer: "Batch transfers are possible if there is space in the other batch. Contact the admin team with your current batch code and the batch you'd like to join.", keywords: ["switch", "change", "transfer", "batch"] },
      { question: "Is there a free course?", answer: "Yes — Career Readiness & Professional Communication is free for everyone. Enroll from the course catalogue; no payment is needed.", keywords: ["free", "no cost", "scholarship"] },
      { question: "How do I reset my password?", answer: "Signed in? Go to Profile and use Change password. If you can't sign in, contact support with your registered email and we'll help you regain access.", keywords: ["password", "reset", "forgot", "login", "sign in"] },
      { question: "Where are the offline classes held?", answer: "Offline classes run at DoB venues in Dhaka — the Innovation Lab in Dhanmondi, the Innovation Hub in Banani and the Learning Centre in Mirpur. Your batch page and schedule show the exact venue for each class.", keywords: ["venue", "location", "address", "offline", "where", "campus"] },
      { question: "How do I contact support?", answer: "Email learn@dreamsofbangladesh.org or call +880 1700-000000 (Sun–Thu, 10am–6pm). You can also ask here and the team will follow up.", keywords: ["contact", "support", "help", "email", "phone", "call"] },
      { question: "What is a coupon code and how do I use it?", answer: "Coupon codes give a discount at checkout. Enter the code in the coupon box on the checkout page and click Apply — the discounted price is shown before you pay.", keywords: ["coupon", "discount", "promo", "code", "offer"] },
    ],
  });

  // Notifications & sample AI review queue for the demo
  await db.notification.createMany({
    data: [
      { userId: demoStudent.id, type: "session", title: "Class starts in 2 hours", body: "Your next class for Full-Stack Web Development starts soon. Check the schedule for the link/venue.", link: "/dashboard/schedule" },
      { userId: demoStudent.id, type: "assessment", title: "Quiz 2 is open", body: "Quiz 2 is now available. Two attempts allowed — due in 5 days.", link: "/dashboard/assessments" },
      { userId: demoStudent.id, type: "result", title: "Assignment graded", body: "Your assignment has been graded. View marks and feedback.", link: "/dashboard/results", readAt: new Date() },
    ],
  });
  const convo = await db.aiConversation.create({ data: { userId: students[3]!.id, title: "Laptop specs" } });
  await db.aiMessage.createMany({
    data: [
      { conversationId: convo.id, role: "USER", content: "Can I use a Chromebook for the Power BI course?" },
      { conversationId: convo.id, role: "ASSISTANT", content: "I don't have a confident answer to that yet, so I've passed your question to the learning team — they'll follow up.", needsReview: true },
    ],
  });

  await db.auditLog.createMany({
    data: [
      { actorId: superAdmin.id, action: "settings.update", entityType: "Setting", metadata: { key: "aiEnabled", value: true }, createdAt: at(-20, 10) },
      { actorId: admin.id, action: "course.publish", entityType: "Course", metadata: { count: COURSES.length }, createdAt: at(-19, 11) },
    ],
  });

  console.log(`\nSeed complete. Sign in with any of these (password: ${PASSWORD}):`);
  console.log("  superadmin@dob.org   (Super Admin)");
  console.log("  admin@dob.org        (Admin)");
  console.log("  arif@dob.org         (Instructor)");
  console.log("  student@dob.org      (Student)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
