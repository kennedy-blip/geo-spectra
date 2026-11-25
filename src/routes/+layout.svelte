<script>
  import { onMount } from 'svelte';
  import '../app.css';
  import fragSrc from '../shaders/seismicRayleighWaveBackground.glsl?raw';

  let canvas;

  onMount(() => {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) return;
    const vsSrc = `#version 300 es
      layout(location=0) in vec2 aPos;
      void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uPga = gl.getUniformLocation(prog, 'uPga');
    const uKg = gl.getUniformLocation(prog, 'uKg');
    const uA = gl.getUniformLocation(prog, 'uTintA');
    const uB = gl.getUniformLocation(prog, 'uTintB');
    const uC = gl.getUniformLocation(prog, 'uTintC');
    gl.uniform3f(uA, 0.96, 0.62, 0.04);
    gl.uniform3f(uB, 0.22, 0.74, 0.97);
    gl.uniform3f(uC, 0.96, 0.25, 0.37);

    let raf;
    const loop = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, performance.now() / 1000);
      // gentle ambient drive; labs can override via window.__geoDrive
      const drive = window.__geoDrive || { pga: 0.08, kg: 6 };
      gl.uniform1f(uPga, drive.pga);
      gl.uniform1f(uKg, drive.kg);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas id="wave-underlay" bind:this={canvas} aria-hidden="true"></canvas>
<slot />
