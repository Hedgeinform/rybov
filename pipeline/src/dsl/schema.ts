import { z } from 'zod';

export const COLORS = [
  'red', 'blue', 'yellow', 'black', 'white',
  'accent_cyan', 'accent_ochre', 'accent_deep_red',
] as const;
export const ColorSchema = z.enum(COLORS);
export type Color = z.infer<typeof ColorSchema>;

export const PRIMITIVES = [
  'triangle', 'ellipse', 'semicircle', 'rectangle',
  'composite_two_triangles', 'semicircle_with_triangle',
] as const;
export const PrimitiveSchema = z.enum(PRIMITIVES);
export type Primitive = z.infer<typeof PrimitiveSchema>;

export const ORIENTATIONS = ['left', 'right'] as const;
export const OrientationSchema = z.enum(ORIENTATIONS);
export type Orientation = z.infer<typeof OrientationSchema>;

export const POSITIONS = [
  'front_top', 'front_center', 'front_low',
  'midline', 'low',
  'tail_side', 'head_top', 'head_bottom',
] as const;
export const PositionSchema = z.enum(POSITIONS);

export const SIZES = ['small', 'medium', 'large'] as const;
export const SizeSchema = z.enum(SIZES);

export const OFFSET_VALUES = [-30, -15, 0, 15, 30] as const;
export const OffsetSchema = z.tuple([
  z.union([z.literal(-30), z.literal(-15), z.literal(0), z.literal(15), z.literal(30)]),
  z.union([z.literal(-30), z.literal(-15), z.literal(0), z.literal(15), z.literal(30)]),
]);

export const EYE_STYLES = ['double_circle', 'dot', 'circle', 'square'] as const;
export const EyeStyleSchema = z.enum(EYE_STYLES);

export const ACCENT_TYPES = [
  'horizontal_line', 'horizontal_band', 'dot', 'small_triangle', 'small_square',
] as const;
export const AccentTypeSchema = z.enum(ACCENT_TYPES);

export const BodySchema = z.object({
  primitive: PrimitiveSchema,
  orientation: OrientationSchema,
  color: ColorSchema,
});

export const EyeSchema = z.object({
  style: EyeStyleSchema,
  position: PositionSchema,
});

export const TailSchema = z.object({
  primitive: PrimitiveSchema,
  color: ColorSchema,
  side: OrientationSchema,
}).nullable();

export const FinSchema = z.object({
  primitive: PrimitiveSchema,
  color: ColorSchema,
}).nullable();

export const BackgroundBlockSchema = z.object({
  color: ColorSchema,
  size: SizeSchema,
  offset: OffsetSchema,
}).nullable();

export const AccentSchema = z.object({
  type: AccentTypeSchema,
  color: ColorSchema,
  position: PositionSchema,
});

export const DSLSchema = z.object({
  body: BodySchema,
  eye: EyeSchema,
  tail: TailSchema,
  fin_top: FinSchema,
  fin_bottom: FinSchema,
  background_block: BackgroundBlockSchema,
  accents: z.array(AccentSchema).max(3),
});

export type DSL = z.infer<typeof DSLSchema>;
