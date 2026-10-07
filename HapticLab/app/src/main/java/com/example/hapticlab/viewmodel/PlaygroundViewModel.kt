package com.example.hapticlab.viewmodel

import androidx.lifecycle.ViewModel
import com.example.hapticlab.data.PrimitiveStep
import com.example.hapticlab.haptic.HapticCapability
import com.example.hapticlab.haptic.HapticEngine
import com.example.hapticlab.haptic.HapticPrimitive
import com.example.hapticlab.haptic.PlaybackState
import com.example.hapticlab.haptic.RepeatMode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/** One editable row of the sequencer. [key] keeps list identity stable while reordering. */
data class SequencerStep(
    val key: Long,
    val primitive: HapticPrimitive,
    val intensity: Float,
    val delayMs: Int,
)

data class PlaygroundUiState(
    /** null = raw one-shot pulse (works on every vibrator). */
    val primitive: HapticPrimitive? = HapticPrimitive.CLICK,
    val intensity: Float = 0.8f,
    val durationMs: Int = 200,
    val delayMs: Int = 60,
    val repeat: RepeatMode = RepeatMode.OFF,
    val steps: List<SequencerStep> = emptyList(),
)

class PlaygroundViewModel(private val engine: HapticEngine) : ViewModel() {

    val capability: HapticCapability = engine.getCapabilities()
    val playback: StateFlow<PlaybackState> = engine.playbackState

    private var nextKey = 0L

    private val _state = MutableStateFlow(
        PlaygroundUiState(
            primitive = HapticPrimitive.CLICK.takeIf { capability.isPrimitiveSupported(it) },
            steps = listOf(
                newStep(HapticPrimitive.THUD, 1.0f, 0),
                newStep(HapticPrimitive.THUD, 0.5f, 80),
                newStep(HapticPrimitive.TICK, 0.3f, 60),
            ),
        ),
    )
    val state: StateFlow<PlaygroundUiState> = _state.asStateFlow()

    private fun newStep(primitive: HapticPrimitive, intensity: Float, delayMs: Int) =
        SequencerStep(nextKey++, primitive, intensity, delayMs)

    // ------------------------------------------------------------ pulse designer

    fun selectPrimitive(primitive: HapticPrimitive?) {
        if (primitive != null && !capability.isPrimitiveSupported(primitive)) return
        _state.update { it.copy(primitive = primitive) }
    }

    fun setIntensity(value: Float) = _state.update { it.copy(intensity = value.coerceIn(0f, 1f)) }

    fun setDuration(value: Int) = _state.update { it.copy(durationMs = value.coerceIn(MIN_DURATION_MS, MAX_DURATION_MS)) }

    fun setDelay(value: Int) = _state.update { it.copy(delayMs = value.coerceIn(0, MAX_DELAY_MS)) }

    fun setRepeat(mode: RepeatMode) = _state.update { it.copy(repeat = mode) }

    /**
     * Primitive: re-triggers the primitive with the chosen delay until [PlaygroundUiState.durationMs]
     * is filled. One-shot: a single raw pulse of that duration.
     */
    fun playPulse() {
        val s = _state.value
        val gap = s.delayMs.toLong().coerceAtLeast(MIN_REPEAT_GAP_MS)
        val primitive = s.primitive
        if (primitive == null) {
            engine.playOneShot(s.durationMs.toLong().coerceAtMost(HapticEngine.MAX_ONE_SHOT_MS), s.intensity, s.repeat, gap)
        } else {
            engine.playSequence(pulseSteps(primitive, s), s.intensity, s.repeat, gap)
        }
    }

    /** Number of primitive hits the pulse designer will produce. */
    fun pulseCount(state: PlaygroundUiState): Int {
        val primitive = state.primitive ?: return 1
        val cycle = capability.primitiveDurationMs(primitive) + state.delayMs
        return (state.durationMs / cycle.coerceAtLeast(1)).coerceIn(1, MAX_PULSE_HITS)
    }

    private fun pulseSteps(primitive: HapticPrimitive, state: PlaygroundUiState): List<PrimitiveStep> =
        List(pulseCount(state)) { i -> PrimitiveStep(primitive, 1f, if (i == 0) 0 else state.delayMs) }

    // ------------------------------------------------------------ sequencer

    fun addStep() = _state.update {
        if (it.steps.size >= MAX_STEPS) return@update it
        val last = it.steps.lastOrNull()
        val primitive = last?.primitive ?: capability.supportedPrimitives.firstOrNull() ?: HapticPrimitive.CLICK
        it.copy(steps = it.steps + newStep(primitive, last?.intensity ?: 0.7f, 80))
    }

    fun removeStep(key: Long) = _state.update { s -> s.copy(steps = s.steps.filterNot { it.key == key }) }

    fun moveStep(key: Long, offset: Int) = _state.update { s ->
        val from = s.steps.indexOfFirst { it.key == key }
        val to = from + offset
        if (from < 0 || to !in s.steps.indices) return@update s
        val list = s.steps.toMutableList()
        list.add(to, list.removeAt(from))
        s.copy(steps = list)
    }

    fun updateStep(key: Long, transform: (SequencerStep) -> SequencerStep) = _state.update { s ->
        s.copy(steps = s.steps.map { if (it.key == key) transform(it) else it })
    }

    fun setStepPrimitive(key: Long, primitive: HapticPrimitive) = updateStep(key) { it.copy(primitive = primitive) }

    fun setStepIntensity(key: Long, value: Float) = updateStep(key) { it.copy(intensity = value.coerceIn(0f, 1f)) }

    fun setStepDelay(key: Long, value: Int) = updateStep(key) { it.copy(delayMs = value.coerceIn(0, MAX_DELAY_MS)) }

    fun playSequence() {
        val s = _state.value
        val steps = s.steps.mapIndexed { i, step ->
            PrimitiveStep(step.primitive, step.intensity, if (i == 0) 0 else step.delayMs)
        }
        engine.playSequence(steps, 1f, s.repeat, SEQUENCE_REPEAT_GAP_MS)
    }

    /** Sequences containing unsupported primitives play through the waveform fallback. */
    fun sequenceUsesFallback(state: PlaygroundUiState): Boolean =
        state.steps.any { !capability.isPrimitiveSupported(it.primitive) }

    fun stop() = engine.stop()

    override fun onCleared() {
        engine.stop()
    }

    companion object {
        const val MIN_DURATION_MS = 10
        const val MAX_DURATION_MS = 1_000
        const val MAX_DELAY_MS = 500
        const val MAX_PULSE_HITS = 40
        const val MAX_STEPS = 16
        private const val MIN_REPEAT_GAP_MS = 150L
        private const val SEQUENCE_REPEAT_GAP_MS = 300L
    }
}
