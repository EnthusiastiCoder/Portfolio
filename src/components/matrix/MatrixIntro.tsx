"use client";

import { useEffect, useState } from "react";
import { readEffects } from "@/lib/effects";
import { prefersReducedMotion } from "@/lib/use-media";

const SESSION_KEY = "matrix-intro";
const DURATION_MS = 800;
const BANDS = ["8%", "34%", "58%", "80%"];
