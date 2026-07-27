A thumbnail of a captured screenshot with the annotated region outlined in accent — use it anywhere a note is listed so the user can see *where* on the page the note points, without opening the full capture.

```jsx
<CaptureMinimap width={72} height={54} region={{x:.42,y:.3,w:.34,h:.16}} label="Captured region on acme.cloud/pricing" onClick={openCapture} />
```

Notes
- The page proxy inside is abstract skeleton bars, not the real screenshot — it stands in for a real capture thumbnail in mocks. In production, render the actual capture image with the same accent-outlined region on top.
- Include it in every generated note/plan output (the note card, the plan view's per-note block). It's intentionally *not* in the form-control set — capturing is not a text field.
- `region` values are fractions of the captured page, so the minimap scales at any size. Use 72×54 in list rows, 120×90 in detail views.
