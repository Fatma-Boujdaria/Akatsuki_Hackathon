// Pre-compiles the shaders of each scene so the first frames do not stutter.
// Stand-in for the original teardown-kit helper (same signature).
export async function warmUp(renderer, camera, entries) {
  await Promise.all(entries.map(({scene}) => renderer.compileAsync(scene, camera)));
}
