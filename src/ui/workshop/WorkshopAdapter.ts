import type { CarConfig } from '../../data/schema';
import type { ResolverVersion } from '../../game/career/tuning/BuildResolver';
import type { BuildTune } from '../../game/career/tuning/buildCommon';
import type { InstallPlan } from '../../game/career/tuning/ProjectRequirements';
import type { PartCategory, PartDef } from '../../game/career/tuning/parts';
import type { PartPreview } from './WorkshopPreviewModel';

export type WorkshopProgression =
  | { mode: 'career'; chapter: number; reputation: number }
  | { mode: 'online'; rp: number; ppBalance: number; unlockedNodes: readonly string[]; treeVersion: number };

export interface WorkshopSnapshot {
  carId: string;
  baseCar: CarConfig;
  nickname: string;
  paint: { color: string; accent: string };
  installedParts: readonly string[];
  inventory: ReadonlyMap<string, number>;
  credits: number;
  buildRevision: number;
  buildVersion: ResolverVersion;
  tune: BuildTune;
  progression: WorkshopProgression;
}

export interface WorkshopUnlock {
  id: string;
  name: string;
  cost: number;
  available: number;
  requirements: readonly string[];
  canUnlock: boolean;
}

export interface WorkshopEligibility {
  state: 'installed' | 'owned' | 'available' | 'unaffordable' | 'locked' | 'stock' | 'incompatible';
  label: string;
  detail: string;
  requirements?: readonly string[];
  unlock?: WorkshopUnlock;
}

export type WorkshopAction =
  | { kind: 'buyAndInstall' | 'buyPart' | 'install' | 'remove'; partId: string }
  | { kind: 'installBundle'; partIds: string[]; maxCost: number }
  | { kind: 'restoreStock'; slot?: PartCategory; slots?: PartCategory[] }
  | { kind: 'unlock'; nodeId: string };

export type WorkshopActionResult = { ok: true; notice?: string } | { ok: false; error: string };

export interface WorkshopAdapter {
  readonly mode: WorkshopProgression['mode'];
  getSnapshot(): WorkshopSnapshot | null;
  getCatalog(includeIncompatible?: boolean): readonly PartDef[];
  getEligibility(part: PartDef): WorkshopEligibility;
  preview(selection: string): PartPreview | Promise<PartPreview>;
  restoreSet?(slot: PartCategory): readonly PartCategory[];
  hasPendingOperation?(): boolean;
  recoverOperation?(): Promise<WorkshopActionResult>;
  execute(action: WorkshopAction): Promise<WorkshopActionResult>;
  refresh(): Promise<void>;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

export interface WorkshopPreviewPolicy {
  versionOf(parts: readonly string[]): ResolverVersion;
  replace(installed: readonly string[], partId: string): string[];
  plan(partId: string): InstallPlan | null;
}
