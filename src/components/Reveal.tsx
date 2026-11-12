"use client";

import * as m from "motion/react-m";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { readEffects, subscribeEffects } from "@/lib/effects";
import { prefersReducedMotion } from "@/lib/use-media";

type Phase = "idle" | "hidden" | "shown";
