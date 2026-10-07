package com.example.hapticlab.data

import com.example.hapticlab.data.HapticCategory.BASIC
import com.example.hapticlab.data.HapticCategory.BOUNCE
import com.example.hapticlab.data.HapticCategory.GAME
import com.example.hapticlab.data.HapticCategory.IMPACT
import com.example.hapticlab.data.HapticCategory.MACHINE
import com.example.hapticlab.data.HapticCategory.MOTION
import com.example.hapticlab.data.HapticCategory.NATURAL
import com.example.hapticlab.data.HapticPatternType.COMPOSITION
import com.example.hapticlab.data.HapticPatternType.ENVELOPE
import com.example.hapticlab.haptic.HapticPrimitive
import com.example.hapticlab.haptic.HapticPrimitive.CLICK
import com.example.hapticlab.haptic.HapticPrimitive.LOW_TICK
import com.example.hapticlab.haptic.HapticPrimitive.QUICK_FALL
import com.example.hapticlab.haptic.HapticPrimitive.QUICK_RISE
import com.example.hapticlab.haptic.HapticPrimitive.SLOW_RISE
import com.example.hapticlab.haptic.HapticPrimitive.SPIN
import com.example.hapticlab.haptic.HapticPrimitive.THUD
import com.example.hapticlab.haptic.HapticPrimitive.TICK
import kotlin.math.roundToInt

/**
 * The 50 Haptic Lab patterns.
 *
 * Tuning rules (after the Android haptics design guidelines):
 * - Primitive scales that should feel different are at least ~0.2 apart; nothing that must be
 *   felt goes below 0.2, because weak primitives disappear on many actuators.
 * - Rhythm carries meaning: decaying gaps for bounces, shrinking gaps + rising scale for
 *   acceleration, irregular gaps for natural phenomena.
 * - THUD / LOW_TICK are "low and heavy", CLICK / TICK are "crisp and light"; SPIN / RISE / FALL
 *   give motion and attack/decay.
 * - Envelope patterns use sharpness as a pitch-like dimension (0 = soft/low, 1 = crisp/high).
 * - Waveform fallbacks keep each "on" segment >= 8 ms (actuator spin-up) and mirror the rhythm
 *   and decay of the primary implementation.
 */
object HapticLibrary {

    val patterns: List<HapticPattern> by lazy { buildPatterns() }

    private val byId: Map<String, HapticPattern> by lazy { patterns.associateBy { it.id } }

    fun find(id: String): HapticPattern? = byId[id]

    fun byCategory(category: HapticCategory): List<HapticPattern> =
        patterns.filter { it.category == category }

    // ---------------------------------------------------------------- DSL helpers

    private fun p(primitive: HapticPrimitive, scale: Float, delayMs: Int = 0) =
        PrimitiveStep(primitive, scale, delayMs)

    /** Waveform from (durationMs to amplitude) segments. */
    private fun wave(vararg segments: Pair<Int, Int>) = WaveformSpec(
        timings = segments.map { it.first.toLong() },
        amplitudes = segments.map { it.second },
    )

    private fun waveOf(segments: List<Pair<Int, Int>>) = wave(*segments.toTypedArray())

    private fun e(intensity: Float, sharpness: Float, durationMs: Long) =
        EnvelopePoint(intensity, sharpness, durationMs)

    private fun env(initialSharpness: Float, vararg points: EnvelopePoint) =
        EnvelopeSpec(initialSharpness, points.toList())

    /** Pulse train: one (on, amplitude) pulse per entry, separated by the given gaps. */
    private fun pulses(onMs: List<Int>, amps: List<Int>, gapsBefore: List<Int>): List<Pair<Int, Int>> {
        val out = mutableListOf<Pair<Int, Int>>()
        for (i in onMs.indices) {
            if (gapsBefore[i] > 0) out += gapsBefore[i] to 0
            out += onMs[i] to amps[i]
        }
        return out
    }

    /** Linear amplitude ramp split into [steps] segments of [stepMs]. */
    private fun ramp(from: Int, to: Int, steps: Int, stepMs: Int): List<Pair<Int, Int>> =
        (1..steps).map { i -> stepMs to (from + (to - from) * i / steps.toFloat()).roundToInt().coerceIn(1, 255) }

    private fun pattern(
        number: Int,
        id: String,
        name: String,
        emoji: String,
        category: HapticCategory,
        description: String,
        type: HapticPatternType = COMPOSITION,
        composition: List<PrimitiveStep>? = null,
        envelope: EnvelopeSpec? = null,
        waveform: WaveformSpec,
        repeatGapMs: Long = 300,
    ) = HapticPattern(
        id = id,
        number = number,
        name = name,
        emoji = emoji,
        description = description,
        category = category,
        patternType = type,
        composition = composition,
        envelope = envelope,
        waveform = waveform,
        repeatGapMs = repeatGapMs,
    )

    // ---------------------------------------------------------------- patterns

    private fun buildPatterns(): List<HapticPattern> = listOf(
        // ===================================================== A. Basic / UI
        pattern(
            1,
            "light_tick",
            "Light Tick",
            "·",
            BASIC,
            "A barely-there tap. The lightest feedback in the library.",
            composition = listOf(p(TICK, 0.35f)),
            waveform = wave(8 to 90),
        ),
        pattern(
            2,
            "normal_tick",
            "Normal Tick",
            "•",
            BASIC,
            "Standard UI tick, like a list item snapping into place.",
            composition = listOf(p(TICK, 0.7f)),
            waveform = wave(10 to 170),
        ),
        pattern(
            3,
            "heavy_tick",
            "Heavy Tick",
            "⬤",
            BASIC,
            "Full-strength low tick: shorter than a click but with weight.",
            composition = listOf(p(LOW_TICK, 1.0f)),
            waveform = wave(14 to 240),
        ),
        pattern(
            4,
            "soft_click",
            "Soft Click",
            "🔘",
            BASIC,
            "Gentle button press with a cushioned attack.",
            composition = listOf(p(CLICK, 0.45f)),
            waveform = wave(6 to 60, 12 to 130, 8 to 50),
        ),
        pattern(
            5,
            "mechanical_click",
            "Mechanical Click",
            "⌨️",
            BASIC,
            "Hard switch actuation followed by a light release snap.",
            composition = listOf(p(CLICK, 1.0f), p(TICK, 0.55f, 30)),
            waveform = wave(12 to 255, 30 to 0, 8 to 150),
        ),
        pattern(
            6,
            "heavy_click",
            "Heavy Click",
            "🔲",
            BASIC,
            "A big, weighty button: crisp edge with a deep body.",
            composition = listOf(p(CLICK, 1.0f), p(THUD, 0.5f)),
            waveform = wave(14 to 255, 22 to 200, 14 to 90),
        ),
        pattern(
            7,
            "double_click",
            "Double Click",
            "⏸",
            BASIC,
            "Tok-tok. Two equal clicks 90 ms apart.",
            composition = listOf(p(CLICK, 0.9f), p(CLICK, 0.9f, 90)),
            waveform = wave(12 to 230, 90 to 0, 12 to 230),
        ),
        pattern(
            8,
            "triple_click",
            "Triple Click",
            "⁂",
            BASIC,
            "Tok-tok-tok. Three quick, even clicks.",
            composition = listOf(p(CLICK, 0.9f), p(CLICK, 0.9f, 70), p(CLICK, 0.9f, 70)),
            waveform = wave(12 to 230, 70 to 0, 12 to 230, 70 to 0, 12 to 230),
        ),
        pattern(
            9,
            "toggle_on",
            "Toggle On",
            "🟢",
            BASIC,
            "Thumb slides and climbs, then snaps into the ON detent.",
            composition = listOf(p(LOW_TICK, 0.4f), p(QUICK_RISE, 0.5f), p(CLICK, 1.0f)),
            waveform = wave(10 to 70, 15 to 90, 15 to 130, 15 to 170, 8 to 0, 14 to 255),
        ),
        pattern(
            10,
            "toggle_off",
            "Toggle Off",
            "⚪",
            BASIC,
            "Release from the detent, energy falls away, soft landing.",
            composition = listOf(p(CLICK, 0.7f), p(QUICK_FALL, 0.5f), p(LOW_TICK, 0.4f, 30)),
            waveform = wave(14 to 200, 8 to 0, 15 to 150, 15 to 100, 15 to 60, 30 to 0, 10 to 90),
        ),

        // ===================================================== B. Impact
        pattern(
            11,
            "light_tap",
            "Light Tap",
            "👆",
            IMPACT,
            "A fingertip tapping the glass: soft, dull and short.",
            composition = listOf(p(THUD, 0.3f)),
            waveform = wave(16 to 100, 12 to 40),
        ),
        pattern(
            12,
            "knock",
            "Knock",
            "🚪",
            IMPACT,
            "One knuckle on a wooden door: solid hit with a woody rattle.",
            composition = listOf(p(THUD, 0.8f), p(TICK, 0.3f, 20)),
            waveform = wave(22 to 230, 8 to 90, 20 to 0, 8 to 80),
        ),
        pattern(
            13, "double_knock", "Double Knock", "✊", IMPACT,
            "Knock-knock, with a natural 160 ms hand rhythm.",
            composition = listOf(p(THUD, 0.85f), p(TICK, 0.3f, 15), p(THUD, 0.85f, 160), p(TICK, 0.3f, 15)),
            waveform = wave(22 to 230, 8 to 90, 160 to 0, 22 to 230, 8 to 90),
            repeatGapMs = 450,
        ),
        pattern(
            14,
            "thud",
            "Thud",
            "🪨",
            IMPACT,
            "A heavy object hits the floor. Deep and round.",
            composition = listOf(p(THUD, 1.0f)),
            waveform = wave(30 to 255, 20 to 160, 20 to 70),
        ),
        pattern(
            15,
            "punch",
            "Punch",
            "👊",
            IMPACT,
            "Short and violent: crisp contact, full body, instant cut-off.",
            composition = listOf(p(CLICK, 1.0f), p(THUD, 1.0f), p(QUICK_FALL, 0.6f)),
            waveform = wave(10 to 255, 30 to 255, 15 to 120),
        ),
        pattern(
            16, "hammer", "Hammer", "🔨", IMPACT,
            "Small lift, a massive strike and a metallic ring that decays.",
            composition = listOf(
                p(LOW_TICK, 0.3f),
                p(THUD, 1.0f, 150),
                p(TICK, 0.5f, 30),
                p(TICK, 0.32f, 40),
                p(TICK, 0.2f, 50),
            ),
            waveform = wave(8 to 70, 150 to 0, 35 to 255, 30 to 0, 8 to 130, 40 to 0, 8 to 80, 50 to 0, 8 to 50),
            repeatGapMs = 400,
        ),
        pattern(
            17,
            "collision",
            "Collision",
            "🚗",
            IMPACT,
            "Two bodies approach, crash, and scatter debris.",
            composition = listOf(p(QUICK_RISE, 0.5f), p(THUD, 1.0f), p(CLICK, 0.6f, 25), p(LOW_TICK, 0.35f, 40)),
            waveform = wave(15 to 60, 15 to 100, 15 to 140, 30 to 255, 25 to 0, 10 to 150, 40 to 0, 10 to 80),
        ),
        pattern(
            18,
            "drop",
            "Drop",
            "📦",
            IMPACT,
            "Something small falls and settles with one little hop.",
            composition = listOf(p(THUD, 0.6f), p(LOW_TICK, 0.35f, 70)),
            waveform = wave(25 to 170, 70 to 0, 10 to 90),
        ),
        pattern(
            19, "heavy_drop", "Heavy Drop", "🏋️", IMPACT,
            "A heavy crate lands, rocks once and comes to rest.",
            composition = listOf(p(THUD, 1.0f), p(THUD, 0.45f, 50), p(LOW_TICK, 0.3f, 90)),
            waveform = wave(45 to 255, 20 to 140, 50 to 0, 25 to 120, 90 to 0, 10 to 70),
            repeatGapMs = 400,
        ),
        pattern(
            20, "explosion", "Explosion", "💣", IMPACT,
            "Maximum attack, then a long rumbling decay that gets lower and softer.",
            type = ENVELOPE,
            envelope = env(
                0.85f,
                e(1.0f, 0.85f, 15),
                e(1.0f, 0.5f, 40),
                e(0.7f, 0.3f, 80),
                e(0.4f, 0.15f, 150),
                e(0.15f, 0.05f, 250),
                e(0f, 0f, 250),
            ),
            composition = listOf(
                p(THUD, 1.0f),
                p(QUICK_FALL, 1.0f),
                p(LOW_TICK, 0.5f, 40),
                p(QUICK_FALL, 0.4f, 20),
                p(LOW_TICK, 0.3f, 80),
                p(LOW_TICK, 0.2f, 120),
            ),
            waveform = wave(40 to 255, 40 to 230, 60 to 180, 80 to 130, 120 to 80, 180 to 40),
            repeatGapMs = 500,
        ),

        // ===================================================== C. Bounce / Elastic
        pattern(
            21, "ball_bounce", "Ball Bounce", "⚽", BOUNCE,
            "A ball falls and bounces: each hit weaker, each gap shorter, then it rolls still.",
            composition = listOf(p(THUD, 1.0f), p(THUD, 0.55f, 130), p(THUD, 0.3f, 90), p(LOW_TICK, 0.2f, 60)),
            waveform = wave(35 to 255, 130 to 0, 25 to 150, 90 to 0, 18 to 85, 60 to 0, 8 to 45),
            repeatGapMs = 600,
        ),
        pattern(
            22, "basketball_bounce", "Basketball Bounce", "🏀", BOUNCE,
            "Big, heavy, slow bounces with a long hang time between hits.",
            composition = listOf(p(THUD, 1.0f), p(THUD, 0.75f, 240), p(THUD, 0.5f, 180), p(THUD, 0.3f, 130)),
            waveform = wave(45 to 255, 240 to 0, 40 to 200, 180 to 0, 32 to 140, 130 to 0, 25 to 85),
            repeatGapMs = 700,
        ),
        pattern(
            23, "ping_pong_bounce", "Ping Pong Bounce", "🏓", BOUNCE,
            "Light, hard ball: crisp clicks that speed up into a rattle.",
            composition = listOf(
                p(CLICK, 0.9f),
                p(CLICK, 0.75f, 130),
                p(CLICK, 0.6f, 95),
                p(TICK, 0.7f, 70),
                p(TICK, 0.55f, 52),
                p(TICK, 0.42f, 38),
                p(TICK, 0.3f, 28),
                p(TICK, 0.2f, 20),
            ),
            waveform = waveOf(
                pulses(
                    onMs = listOf(12, 12, 11, 10, 9, 8, 8, 8),
                    amps = listOf(230, 190, 150, 140, 110, 85, 60, 40),
                    gapsBefore = listOf(0, 130, 95, 70, 52, 38, 28, 20),
                ),
            ),
            repeatGapMs = 500,
        ),
        pattern(
            24, "rubber_ball", "Rubber Ball", "🔴", BOUNCE,
            "Super-elastic ball: many rapid bounces with geometric decay in force and time.",
            composition = listOf(
                p(THUD, 1.0f), p(THUD, 0.78f, 150), p(THUD, 0.6f, 110), p(LOW_TICK, 0.65f, 80),
                p(LOW_TICK, 0.5f, 58), p(LOW_TICK, 0.38f, 42), p(LOW_TICK, 0.28f, 30),
                p(TICK, 0.25f, 22), p(TICK, 0.2f, 16),
            ),
            waveform = waveOf(
                pulses(
                    onMs = listOf(32, 26, 22, 14, 12, 10, 9, 8, 8),
                    amps = listOf(255, 200, 160, 150, 120, 95, 72, 55, 40),
                    gapsBefore = listOf(0, 150, 110, 80, 58, 42, 30, 22, 16),
                ),
            ),
            repeatGapMs = 600,
        ),
        pattern(
            25, "spring", "Spring", "🌀", BOUNCE,
            "Slowly compressed, released with a snap, then a decaying boing oscillation.",
            type = ENVELOPE,
            envelope = env(
                0.15f,
                e(0.45f, 0.2f, 300), e(0.05f, 0.3f, 20), e(1.0f, 0.9f, 15),
                e(0.15f, 0.6f, 35), e(0.7f, 0.7f, 35), e(0.12f, 0.6f, 35), e(0.45f, 0.65f, 35),
                e(0.08f, 0.6f, 35), e(0.25f, 0.6f, 35), e(0f, 0.5f, 40),
            ),
            composition = listOf(
                p(SLOW_RISE, 0.5f),
                p(CLICK, 1.0f, 30),
                p(SPIN, 0.45f),
                p(LOW_TICK, 0.4f, 45),
                p(LOW_TICK, 0.25f, 45),
            ),
            waveform = waveOf(
                ramp(30, 120, 6, 50) + listOf(
                    20 to 0, 15 to 255, 30 to 30, 30 to 180, 30 to 25, 30 to 120, 30 to 20, 30 to 70, 30 to 0,
                ),
            ),
            repeatGapMs = 500,
        ),
        pattern(
            26, "rubber_band", "Rubber Band", "🪢", BOUNCE,
            "Creaking tension builds as it stretches, then it lets go with a slap.",
            composition = listOf(
                p(LOW_TICK, 0.2f),
                p(LOW_TICK, 0.3f, 70),
                p(LOW_TICK, 0.4f, 55),
                p(LOW_TICK, 0.5f, 45),
                p(LOW_TICK, 0.6f, 35),
                p(CLICK, 1.0f, 120),
                p(QUICK_FALL, 0.5f),
            ),
            waveform = waveOf(
                pulses(
                    onMs = listOf(10, 10, 10, 10, 10, 14),
                    amps = listOf(50, 75, 100, 125, 150, 255),
                    gapsBefore = listOf(0, 70, 55, 45, 35, 120),
                ) + listOf(15 to 140, 15 to 70),
            ),
            repeatGapMs = 450,
        ),

        // ===================================================== D. Motion
        pattern(
            27,
            "spin",
            "Spin",
            "🔄",
            MOTION,
            "A single wobbling spin-up.",
            composition = listOf(p(SPIN, 0.8f)),
            waveform = wave(20 to 110, 18 to 200, 18 to 120, 18 to 210, 20 to 120, 25 to 60),
        ),
        pattern(
            28, "fast_spin", "Fast Spin", "💫", MOTION,
            "Back-to-back spins gaining energy, like a top whipped faster.",
            composition = listOf(p(SPIN, 0.7f), p(SPIN, 0.85f), p(SPIN, 1.0f)),
            waveform = waveOf((0 until 14).map { i -> 12 to if (i % 2 == 0) 140 + i * 8 else 70 + i * 4 } + listOf(20 to 90)),
            repeatGapMs = 150,
        ),
        pattern(
            29, "slow_spin", "Slow Spin", "🎡", MOTION,
            "A heavy wheel coasting: soft spins, each one slower and weaker.",
            composition = listOf(p(SPIN, 0.55f), p(SPIN, 0.45f, 140), p(SPIN, 0.35f, 200)),
            waveform = wave(
                25 to 80, 25 to 140, 25 to 80, 140 to 0,
                30 to 65, 30 to 115, 30 to 65, 200 to 0,
                35 to 55, 35 to 90, 35 to 50,
            ),
            repeatGapMs = 400,
        ),
        pattern(
            30, "rolling", "Rolling", "🎱", MOTION,
            "A marble rolling over a slightly uneven table.",
            composition = listOf(
                p(LOW_TICK, 0.35f), p(LOW_TICK, 0.28f, 45), p(LOW_TICK, 0.4f, 52), p(LOW_TICK, 0.3f, 40),
                p(LOW_TICK, 0.38f, 58), p(LOW_TICK, 0.26f, 47), p(LOW_TICK, 0.36f, 55), p(LOW_TICK, 0.3f, 43),
                p(LOW_TICK, 0.25f, 60), p(LOW_TICK, 0.2f, 70),
            ),
            waveform = waveOf(
                pulses(
                    onMs = List(10) { 10 },
                    amps = listOf(95, 75, 105, 80, 100, 70, 95, 80, 65, 50),
                    gapsBefore = listOf(0, 45, 52, 40, 58, 47, 55, 43, 60, 70),
                ),
            ),
            repeatGapMs = 40,
        ),
        pattern(
            31, "gear", "Gear", "⚙️", MOTION,
            "Teeth meshing: a clack and a dull thunk for every tooth.",
            composition = listOf(
                p(CLICK, 0.65f),
                p(LOW_TICK, 0.5f, 15),
                p(CLICK, 0.65f, 80),
                p(LOW_TICK, 0.5f, 15),
                p(CLICK, 0.65f, 80),
                p(LOW_TICK, 0.5f, 15),
                p(CLICK, 0.65f, 80),
                p(LOW_TICK, 0.5f, 15),
            ),
            waveform = waveOf(
                (0 until 4).flatMap { i -> (if (i > 0) listOf(80 to 0) else emptyList()) + listOf(10 to 170, 15 to 0, 12 to 120) },
            ),
            repeatGapMs = 80,
        ),
        pattern(
            32, "ratchet", "Ratchet", "🔧", MOTION,
            "The pawl climbs each tooth with rising tension, then drops with a sharp clack.",
            composition = (0 until 3).flatMap { i ->
                listOf(p(LOW_TICK, 0.25f, if (i == 0) 0 else 110), p(TICK, 0.4f, 30), p(CLICK, 1.0f, 30))
            },
            waveform = waveOf(
                (0 until 3).flatMap { i ->
                    (if (i > 0) listOf(110 to 0) else emptyList()) +
                        listOf(8 to 60, 30 to 0, 8 to 110, 30 to 0, 12 to 255)
                },
            ),
            repeatGapMs = 110,
        ),
        pattern(
            33, "dial", "Dial", "🎛️", MOTION,
            "A rotary knob moved one detent at a time: identical, precise steps.",
            composition = listOf(
                p(TICK, 0.85f),
                p(TICK, 0.85f, 130),
                p(TICK, 0.85f, 130),
                p(TICK, 0.85f, 130),
                p(TICK, 0.85f, 130),
            ),
            waveform = waveOf(pulses(List(5) { 9 }, List(5) { 210 }, listOf(0, 130, 130, 130, 130))),
            repeatGapMs = 130,
        ),
        pattern(
            34, "fast_dial", "Fast Dial", "⏩", MOTION,
            "A flicked dial: detents accelerate, then coast to a stop.",
            composition = listOf(0, 80, 62, 50, 40, 34, 30, 30, 32, 38, 48, 62).map { d -> p(TICK, 0.75f, d) },
            waveform = waveOf(pulses(List(12) { 8 }, List(12) { 190 }, listOf(0, 80, 62, 50, 40, 34, 30, 30, 32, 38, 48, 62))),
            repeatGapMs = 200,
        ),

        // ===================================================== E. Natural
        pattern(
            35, "water_drop", "Single Water Drop", "💧", NATURAL,
            "A bright 'plip' as the drop hits, then a soft, round 'plop' that fades.",
            type = ENVELOPE,
            envelope = env(
                1.0f,
                e(0.85f, 1.0f, 12),
                e(0.05f, 0.9f, 20),
                e(0.4f, 0.25f, 35),
                e(0.25f, 0.2f, 40),
                e(0f, 0.15f, 80),
            ),
            composition = listOf(p(TICK, 1.0f), p(LOW_TICK, 0.45f, 35), p(QUICK_FALL, 0.3f)),
            waveform = wave(8 to 200, 30 to 0, 15 to 110, 20 to 70, 30 to 30),
            repeatGapMs = 700,
        ),
        pattern(
            36, "water_drops", "Water Drops", "💦", NATURAL,
            "Four drops from a leaky tap, each with its own size and timing.",
            composition = listOf(
                p(TICK, 0.9f),
                p(LOW_TICK, 0.35f, 30),
                p(TICK, 0.6f, 220),
                p(LOW_TICK, 0.25f, 30),
                p(TICK, 1.0f, 140),
                p(LOW_TICK, 0.4f, 30),
                p(TICK, 0.5f, 300),
                p(LOW_TICK, 0.2f, 30),
            ),
            waveform = wave(
                8 to 190, 30 to 0, 12 to 80, 220 to 0,
                8 to 130, 30 to 0, 12 to 60, 140 to 0,
                8 to 220, 30 to 0, 12 to 90, 300 to 0,
                8 to 110, 30 to 0, 12 to 45,
            ),
            repeatGapMs = 250,
        ),
        pattern(
            37, "rain", "Rain", "🌧️", NATURAL,
            "Light rain on a window: irregular, tiny, never quite the same.",
            composition = listOf(
                0 to 0.4f, 35 to 0.25f, 80 to 0.5f, 22 to 0.2f, 60 to 0.35f, 110 to 0.55f, 30 to 0.25f,
                45 to 0.3f, 95 to 0.45f, 20 to 0.2f, 70 to 0.4f, 40 to 0.28f, 100 to 0.5f, 25 to 0.22f,
                65 to 0.33f, 50 to 0.38f,
            ).map { (d, s) -> p(TICK, s, d) },
            waveform = waveOf(
                pulses(
                    onMs = List(16) { 7 },
                    amps = listOf(100, 65, 125, 55, 90, 135, 65, 75, 115, 55, 100, 72, 125, 58, 85, 95),
                    gapsBefore = listOf(0, 35, 80, 22, 60, 110, 30, 45, 95, 20, 70, 40, 100, 25, 65, 50),
                ),
            ),
            repeatGapMs = 60,
        ),
        pattern(
            38, "heartbeat", "Heartbeat", "❤️", NATURAL,
            "Resting heart (~65 BPM): strong 'lub', short pause, softer 'dub', long rest.",
            composition = listOf(p(THUD, 1.0f), p(THUD, 0.55f, 130), p(THUD, 1.0f, 650), p(THUD, 0.55f, 130)),
            waveform = wave(40 to 255, 130 to 0, 30 to 150, 650 to 0, 40 to 255, 130 to 0, 30 to 150),
            repeatGapMs = 650,
        ),
        pattern(
            39, "fast_heartbeat", "Fast Heartbeat", "💓", NATURAL,
            "A nervous heart (~140 BPM): tighter lub-dub, almost no rest.",
            composition = listOf(
                p(THUD, 1.0f),
                p(THUD, 0.6f, 80),
                p(THUD, 1.0f, 280),
                p(THUD, 0.6f, 80),
                p(THUD, 1.0f, 280),
                p(THUD, 0.6f, 80),
            ),
            waveform = wave(
                35 to 255, 80 to 0, 25 to 160, 280 to 0,
                35 to 255, 80 to 0, 25 to 160, 280 to 0,
                35 to 255, 80 to 0, 25 to 160,
            ),
            repeatGapMs = 280,
        ),
        pattern(
            40, "breathing", "Breathing", "🫁", NATURAL,
            "Slow inhale, brief hold, longer exhale. Smooth and low.",
            type = ENVELOPE,
            envelope = env(
                0.05f,
                e(0.15f, 0.05f, 300),
                e(0.4f, 0.1f, 400),
                e(0.6f, 0.12f, 500),
                e(0.6f, 0.12f, 250),
                e(0.35f, 0.08f, 600),
                e(0.12f, 0.05f, 600),
                e(0f, 0f, 400),
            ),
            composition = listOf(p(SLOW_RISE, 0.35f), p(SLOW_RISE, 0.6f), p(QUICK_FALL, 0.45f, 200), p(QUICK_FALL, 0.25f)),
            waveform = waveOf(ramp(10, 150, 24, 50) + listOf(250 to 150) + ramp(150, 8, 32, 50)),
            repeatGapMs = 800,
        ),

        // ===================================================== F. Machine
        pattern(
            41, "small_motor", "Small Motor", "🪫", MACHINE,
            "A tiny DC motor: light, fast, high-pitched and steady.",
            type = ENVELOPE,
            envelope = env(
                0.9f,
                e(0.35f, 0.9f, 60),
                e(0.35f, 0.95f, 200),
                e(0.32f, 0.9f, 200),
                e(0.36f, 0.95f, 200),
                e(0f, 0.9f, 60),
            ),
            waveform = waveOf(listOf(30 to 60) + (0 until 26).map { i -> 25 to if (i % 2 == 0) 95 else 80 } + listOf(30 to 40)),
            repeatGapMs = 0,
        ),
        pattern(
            42, "electric_motor", "Electric Motor", "🔌", MACHINE,
            "A stronger motor: spins up, runs with mid-pitch hum, spins down.",
            type = ENVELOPE,
            envelope = env(
                0.4f,
                e(0.55f, 0.6f, 150),
                e(0.65f, 0.7f, 250),
                e(0.6f, 0.7f, 250),
                e(0.65f, 0.7f, 200),
                e(0f, 0.4f, 250),
            ),
            waveform = waveOf(
                ramp(40, 170, 6, 25) + (0 until 14).map { i -> 50 to if (i % 2 == 0) 175 else 160 } + ramp(160, 20, 8, 30),
            ),
            repeatGapMs = 0,
        ),
        pattern(
            43, "engine_idle", "Engine Idle", "🚙", MACHINE,
            "A car idling: low, lumpy, slightly uneven combustion pulses.",
            type = ENVELOPE,
            envelope = env(
                0.1f,
                e(0.6f, 0.1f, 30), e(0.2f, 0.08f, 55), e(0.55f, 0.1f, 30), e(0.18f, 0.08f, 60),
                e(0.62f, 0.12f, 30), e(0.22f, 0.08f, 50), e(0.5f, 0.1f, 30), e(0.18f, 0.08f, 62),
                e(0.6f, 0.1f, 30), e(0.2f, 0.08f, 55), e(0.56f, 0.11f, 30), e(0.2f, 0.08f, 58),
                e(0.6f, 0.1f, 30), e(0f, 0.05f, 50),
            ),
            composition = listOf(
                p(THUD, 0.5f),
                p(THUD, 0.35f, 45),
                p(THUD, 0.55f, 45),
                p(THUD, 0.3f, 50),
                p(THUD, 0.5f, 45),
                p(THUD, 0.35f, 45),
                p(THUD, 0.55f, 50),
                p(THUD, 0.35f, 45),
            ),
            waveform = waveOf(
                listOf(
                    30 to 170, 55 to 45, 30 to 160, 60 to 40, 30 to 180, 50 to 50, 30 to 150, 62 to 40,
                    30 to 170, 55 to 45, 30 to 165, 58 to 45, 30 to 170, 50 to 20,
                ),
            ),
            repeatGapMs = 0,
        ),
        pattern(
            44, "engine_rev", "Engine Rev", "🏎️", MACHINE,
            "RPM climbs: pulses get closer together, stronger and higher in pitch.",
            type = ENVELOPE,
            envelope = engineRevEnvelope(),
            composition = listOf(0, 120, 105, 90, 78, 66, 56, 48, 41, 35, 30, 26, 23, 20).mapIndexed { i, d ->
                val prim = when {
                    i < 5 -> THUD
                    i < 10 -> LOW_TICK
                    else -> CLICK
                }
                p(prim, (0.3f + 0.7f * i / 13f).coerceAtMost(1f), d)
            },
            waveform = engineRevWaveform(),
            repeatGapMs = 400,
        ),
        pattern(
            45, "power_tool", "Power Tool", "🪚", MACHINE,
            "A drill biting into wood: hard start, rough grinding load, wind-down.",
            type = ENVELOPE,
            envelope = env(
                0.6f,
                e(0.85f, 0.75f, 60), e(0.95f, 0.8f, 80), e(0.75f, 0.7f, 80), e(1.0f, 0.85f, 80), e(0.8f, 0.75f, 80),
                e(0.95f, 0.8f, 80), e(0.7f, 0.7f, 80), e(1.0f, 0.85f, 80), e(0.3f, 0.5f, 120), e(0f, 0.3f, 100),
            ),
            waveform = waveOf(
                listOf(30 to 200, 30 to 255) + (0 until 28).map { i ->
                    20 to if (i % 3 == 2) {
                        170
                    } else if (i % 2 == 0) {
                        255
                    } else {
                        200
                    }
                } +
                    ramp(180, 20, 5, 40),
            ),
            repeatGapMs = 0,
        ),
        pattern(
            46, "electric_toothbrush", "Electric Toothbrush", "🪥", MACHINE,
            "Fine, high-frequency micro-vibration delivered in three sonic bursts.",
            type = ENVELOPE,
            envelope = env(
                1.0f,
                e(0.4f, 1.0f, 20), e(0.42f, 1.0f, 230), e(0f, 1.0f, 20), e(0f, 1.0f, 60),
                e(0.4f, 1.0f, 20), e(0.42f, 1.0f, 230), e(0f, 1.0f, 20), e(0f, 1.0f, 60),
                e(0.4f, 1.0f, 20), e(0.42f, 1.0f, 230), e(0f, 1.0f, 20),
            ),
            waveform = waveOf(
                (0 until 3).flatMap { burst ->
                    (if (burst > 0) listOf(60 to 0) else emptyList()) +
                        (0 until 12).map { i -> 10 to if (i % 2 == 0) 110 else 70 } + listOf(20 to 40)
                },
            ),
            repeatGapMs = 60,
        ),

        // ===================================================== G. Game / Interaction
        pattern(
            47, "gun_recoil", "Gun Recoil", "🔫", GAME,
            "Sharp shot, hard kick into the hand, then small residual shakes.",
            composition = listOf(
                p(CLICK, 1.0f),
                p(THUD, 1.0f),
                p(QUICK_FALL, 0.7f),
                p(LOW_TICK, 0.3f, 45),
                p(LOW_TICK, 0.2f, 50),
            ),
            waveform = wave(10 to 255, 25 to 255, 20 to 160, 15 to 80, 45 to 0, 10 to 70, 50 to 0, 8 to 40),
            repeatGapMs = 350,
        ),
        pattern(
            48, "charging", "Charging", "🔋", GAME,
            "Energy builds: intensity and sharpness climb together toward a peak.",
            type = ENVELOPE,
            envelope = env(
                0.1f,
                e(0.1f, 0.1f, 150),
                e(0.2f, 0.25f, 250),
                e(0.35f, 0.4f, 300),
                e(0.55f, 0.6f, 300),
                e(0.8f, 0.8f, 300),
                e(0.95f, 0.95f, 200),
                e(0f, 1.0f, 30),
            ),
            composition = listOf(p(SLOW_RISE, 0.3f), p(SLOW_RISE, 0.55f), p(SLOW_RISE, 0.8f), p(QUICK_RISE, 1.0f), p(TICK, 0.6f)),
            waveform = waveOf(
                pulses(
                    onMs = List(16) { 30 },
                    amps = (0 until 16).map { i -> 40 + i * 14 },
                    gapsBefore = (0 until 16).map { i -> if (i == 0) 0 else (90 - i * 5).coerceAtLeast(10) },
                ),
            ),
            repeatGapMs = 300,
        ),
        pattern(
            49, "power_release", "Power Release", "⚡", GAME,
            "Charge up, a split-second of silence, then everything released at once.",
            type = ENVELOPE,
            envelope = env(
                0.2f,
                e(0.3f, 0.3f, 200), e(0.55f, 0.55f, 250), e(0.75f, 0.8f, 200), e(0f, 0.8f, 15), e(0f, 0.5f, 70),
                e(1.0f, 0.35f, 15), e(0.8f, 0.25f, 60), e(0.4f, 0.15f, 120), e(0.15f, 0.1f, 150), e(0f, 0.05f, 150),
            ),
            composition = listOf(
                p(SLOW_RISE, 0.6f),
                p(QUICK_RISE, 0.85f),
                p(THUD, 1.0f, 80),
                p(QUICK_FALL, 0.9f),
                p(LOW_TICK, 0.35f, 60),
                p(LOW_TICK, 0.2f, 80),
            ),
            waveform = waveOf(
                ramp(30, 170, 13, 50) + listOf(80 to 0, 40 to 255, 50 to 210, 80 to 140, 120 to 70, 120 to 30),
            ),
            repeatGapMs = 600,
        ),
        pattern(
            50, "magic_pulse", "Magic Pulse", "✨", GAME,
            "Sci-fi shimmer: strong-crisp and weak-soft beats alternating, then fading.",
            type = ENVELOPE,
            envelope = env(
                0.9f,
                e(0.8f, 0.95f, 70), e(0.2f, 0.35f, 70), e(0.85f, 0.95f, 70), e(0.2f, 0.35f, 70),
                e(0.75f, 0.9f, 70), e(0.18f, 0.3f, 70), e(0.6f, 0.85f, 70), e(0.15f, 0.3f, 70),
                e(0.4f, 0.8f, 70), e(0f, 0.5f, 120),
            ),
            composition = listOf(
                p(QUICK_RISE, 0.5f),
                p(QUICK_FALL, 0.9f),
                p(QUICK_RISE, 0.4f, 30),
                p(QUICK_FALL, 0.7f),
                p(SPIN, 0.5f, 30),
                p(QUICK_FALL, 0.4f),
            ),
            waveform = wave(
                60 to 220, 60 to 60, 60 to 230, 60 to 55, 60 to 200, 60 to 50, 60 to 160, 60 to 40, 60 to 110, 80 to 20,
            ),
            repeatGapMs = 300,
        ),
    )

    /**
     * Engine rev envelope: 12 combustion cycles. Period shrinks 120 -> 30 ms, peak rises
     * 0.35 -> 1.0 and sharpness climbs 0.1 -> 0.75 so the "pitch" rises with RPM.
     */
    private fun engineRevEnvelope(): EnvelopeSpec {
        val cycles = 12
        val points = mutableListOf<EnvelopePoint>()
        for (i in 0 until cycles) {
            val t = i / (cycles - 1f)
            val period = (120 - 90 * t).roundToInt()
            val peak = 0.35f + 0.65f * t
            val sharp = 0.1f + 0.65f * t
            val attack = (period * 0.4f).roundToInt().coerceAtLeast(12).toLong()
            val release = (period - attack).coerceAtLeast(12)
            points += EnvelopePoint(peak, sharp, attack)
            points += EnvelopePoint(peak * 0.3f, sharp, release)
        }
        points += EnvelopePoint(0f, 0.6f, 120)
        return EnvelopeSpec(0.1f, points)
    }

    private fun engineRevWaveform(): WaveformSpec {
        val gaps = listOf(0, 120, 105, 90, 78, 66, 56, 48, 41, 35, 30, 26, 23, 20)
        val segments = mutableListOf<Pair<Int, Int>>()
        gaps.forEachIndexed { i, gap ->
            if (gap > 0) segments += gap to 30 // never fully off: the engine keeps humming
            val t = i / (gaps.size - 1f)
            segments += (25 - 13 * t).roundToInt() to (80 + 175 * t).roundToInt()
        }
        segments += 60 to 120
        segments += 60 to 40
        return waveOf(segments)
    }
}
