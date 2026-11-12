"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { EFFECTS_EVENT, readEffects } from "@/lib/effects";
import { prefersReducedMotion } from "@/lib/use-media";
