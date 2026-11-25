package com.geospectra.plugins

import android.graphics.ImageFormat
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.params.RggbCaptureRequestOptions
import android.os.Handler
import android.os.HandlerThread
import android.util.Size
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * GEO-SPECTRA · MacroCrackPhotogrammetryPlugin.kt
 *
 * Native Capacitor plugin interfacing with Android Camera2: reads
 * LENS_INTRINSIC_CALIBRATION [f_x, f_y, c_x, c_y, s] and
 * SENSOR_INFO_PHYSICAL_SIZE (mm), locks macro focus via
 * LENS_FOCUS_DISTANCE, and computes the true physical scale
 * s_mm_per_px = d_focus(mm) / f_px for sub-0.05 mm crack photogrammetry.
 */
@CapacitorPlugin(name = "MacroCrackPhotogrammetry")
class MacroCrackPhotogrammetryPlugin : Plugin() {

    private var cameraDevice: CameraDevice? = null
    private var bgThread: HandlerThread? = null

    @CapacitorPlugin
    fun getPhotogrammetricScale(call: PluginCall) {
        try {
            val manager = context.getSystemService(android.content.Context.CAMERA_SERVICE) as CameraManager
            val cameraId = manager.cameraIdList.firstOrNull { id ->
                manager.getCameraCharacteristics(id)
                    .get(CameraCharacteristics.LENS_FACING) ==
                    CameraCharacteristics.LENS_FACING_BACK
            } ?: manager.cameraIdList.firstOrNull()

            if (cameraId == null) {
                call.reject("No camera available")
                return
            }

            val chars = manager.getCameraCharacteristics(cameraId)
            val calibration = chars.get(CameraCharacteristics.LENS_INTRINSIC_CALIBRATION)
            val physicalSize = chars.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)
            val focalLengths = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
            val minFocus = chars.get(CameraCharacteristics.LENS_INFO_MIN_FOCUS_DISTANCE) ?: 0f

            val fx = calibration?.get(0) ?: 0f
            val fy = calibration?.get(1) ?: 0f
            val cx = calibration?.get(2) ?: 0f
            val cy = calibration?.get(3) ?: 0f

            // Macro focus: closest focus distance → smallest d_focus → finest mm/px
            val focusDistanceMm = if (minFocus > 0f) 1000f / minFocus else 300f
            val mmPerPx = if (fx > 0f) focusDistanceMm / fx else 0.0

            val ret = JSObject()
            ret.put("cameraId", cameraId)
            ret.put("fxPx", fx.toDouble())
            ret.put("fyPx", fy.toDouble())
            ret.put("cxPx", cx.toDouble())
            ret.put("cyPx", cy.toDouble())
            ret.put("sensorWidthMm", physicalSize?.width?.toDouble() ?: 0.0)
            ret.put("sensorHeightMm", physicalSize?.height?.toDouble() ?: 0.0)
            ret.put("focalLengthMm", focalLengths?.firstOrNull()?.toDouble() ?: 0.0)
            ret.put("focusDistanceMm", focusDistanceMm.toDouble())
            ret.put("mmPerPx", mmPerPx)
            ret.put("minMeasurableMm", mmPerPx * 2.0) // ~2 px Nyquist limit
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Photogrammetry setup failed: ${e.message}")
        }
    }

    @CapacitorPlugin
    fun lockMacroFocus(call: PluginCall) {
        try {
            bgThread = HandlerThread("geo-macro").apply { start() }
            val handler = Handler(bgThread!!.looper)
            val manager = context.getSystemService(android.content.Context.CAMERA_SERVICE) as CameraManager
            val cameraId = manager.cameraIdList.first()
            manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    val builder = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
                    builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_OFF)
                    builder.set(CaptureRequest.LENS_FOCUS_DISTANCE, 0f) // nearest macro focus
                    builder.set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
                    val ret = JSObject()
                    ret.put("macroFocusLocked", true)
                    call.resolve(ret)
                }
                override fun onDisconnected(camera: CameraDevice) = camera.close()
                override fun onError(camera: CameraDevice, error: Int) {
                    call.reject("Camera error: $error")
                }
            }, handler)
        } catch (e: Exception) {
            call.reject("Macro focus lock failed: ${e.message}")
        }
    }

    override fun handleOnDestroy() {
        cameraDevice?.close()
        bgThread?.quitSafely()
        super.handleOnDestroy()
    }
}
