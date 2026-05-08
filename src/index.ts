import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import eventsRoutes from "./routes/events.js";
import checkinRoutes from "./routes/checkin.js";
import registerRoutes from "./routes/register.js";

const app = express();
const PORT = process.env.PORT || 3001;

// --- CORS ---
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000").split(",").map((s) => s.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow no-origin requests (e.g., server-to-server, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

// --- Health check ---
app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// --- Routes ---
app.use("/auth", authRoutes);
app.use("/events", eventsRoutes);
app.use("/checkin", checkinRoutes);
app.use("/register", registerRoutes);

// --- 404 ---
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`JBS Backend running on port ${PORT}`);
});

export default app;
