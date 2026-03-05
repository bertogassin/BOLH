package com.guardian.android.ui.utils

import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalView

object HapticManager {

    fun View.buttonTap() {
        performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
    }

    fun View.success() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            performHapticFeedback(HapticFeedbackConstants.CONFIRM)
        } else {
            performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
        }
    }

    fun View.error() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            performHapticFeedback(HapticFeedbackConstants.REJECT)
        } else {
            performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
        }
    }

    fun View.warning() {
        performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
    }

    fun View.searching(vibrator: Vibrator) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val pattern = longArrayOf(0, 50, 100, 50, 100, 50)
            val amplitudes = intArrayOf(0, 80, 0, 80, 0, 80)
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, amplitudes, -1))
        }
    }

    fun View.matchFound(vibrator: Vibrator) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val pattern = longArrayOf(0, 30, 20, 50)
            val amplitudes = intArrayOf(0, 100, 0, 150)
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, amplitudes, -1))
        }
    }
}

@Composable
fun rememberViewForHaptic(): View = LocalView.current
