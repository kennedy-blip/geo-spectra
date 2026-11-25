package com.geospectra.plugins

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import kotlin.math.atan2
import kotlin.math.sqrt

/**
 * GEO-SPECTRA · GeophoneMicrotremorImuPlugin.kt
 *
 * Native Capacitor plugin streaming 3-axis microtremor arrays (Gal cm/s²) at
 * SENSOR_DELAY_FASTEST (~200 Hz) with hardware nanosecond timestamps for
 * Nakamura HVSR analysis, plus 0.01° Euler pitch/roll for retaining-wall
 * tilt clinometry. DC-offset removal runs on-device.
 */
@CapacitorPlugin(name = "GeophoneMicrotremorImu")
class GeophoneMicrotremorImuPlugin : Plugin(), SensorEventListener {

    private var sensorManager: SensorManager? = null
    private var running = false
    private var call: PluginCall? = null

    // DC-offset accumulators (running mean, removed before streaming)
    private var meanX = 0.0
    private var meanY = 0.0
    private var meanZ = 0.0
    private var samples = 0L
    private var lastTimestampNs = 0L
    private var sampleRateHz = 0.0

    @CapacitorPlugin
    fun startMicrotremor(call: PluginCall) {
        this.call = call
        sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val types = intArrayOf(
            Sensor.TYPE_ACCELEROMETER,
            Sensor.TYPE_LINEAR_ACCELERATION,
            Sensor.TYPE_GYROSCOPE,
            Sensor.TYPE_GAME_ROTATION_VECTOR
        )
        var registered = 0
        for (t in types) {
            val s = sensorManager?.getDefaultSensor(t) ?: continue
            if (sensorManager?.registerListener(this, s, SensorManager.SENSOR_DELAY_FASTEST) == true) {
                registered++
            }
        }
        running = registered > 0
        val ret = JSObject()
        ret.put("registeredSensors", registered)
        ret.put("targetHz", 200)
        ret.put("running", running)
        call.resolve(ret)
    }

    @CapacitorPlugin
    fun stopMicrotremor(call: PluginCall) {
        sensorManager?.unregisterListener(this)
        running = false
        val ret = JSObject()
        ret.put("running", false)
        ret.put("samples", samples)
        ret.put("sampleRateHz", sampleRateHz)
        call.resolve(ret)
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (!running || call == null) return
        if (event.sensor.type != Sensor.TYPE_ACCELEROMETER) return

        val dtNs = event.timestamp - lastTimestampNs
        if (lastTimestampNs != 0L && dtNs > 0) {
            sampleRateHz = 1e9 / dtNs.toDouble()
        }
        lastTimestampNs = event.timestamp

        // running DC-offset estimate (gravity + bias), removed on-device
        samples++
        val a = 1.0 / samples.toDouble()
        meanX += (event.values[0] - meanX) * a
        meanY += (event.values[1] - meanY) * a
        meanZ += (event.values[2] - meanZ) * a

        // convert m/s² → Gal (cm/s²): 1 m/s² = 100 Gal
        val gx = (event.values[0] - meanX) * 100.0
        val gy = (event.values[1] - meanY) * 100.0
        val gz = (event.values[2] - meanZ) * 100.0

        // Euler pitch/roll from gravity vector for 0.01° clinometry
        val mag = sqrt(
            event.values[0] * event.values[0] +
            event.values[1] * event.values[1] +
            event.values[2] * event.values[2]
        ).toDouble()
        val pitchDeg = Math.toDegrees(atan2(-event.values[1].toDouble(), mag))
        val rollDeg = Math.toDegrees(atan2(event.values[0].toDouble(), mag))

        val payload = JSObject()
        payload.put("axGal", gx)
        payload.put("ayGal", gy)
        payload.put("azGal", gz)
        payload.put("timestampNs", event.timestamp)
        payload.put("pitchDeg", pitchDeg)
        payload.put("rollDeg", rollDeg)
        payload.put("sampleRateHz", sampleRateHz)
        call?.resolve(payload)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
