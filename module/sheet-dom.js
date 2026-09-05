/** Apply the common read-only DOM state used by Brinkwood sheets. */
export function lockSheetFormControls(html) {
  html.querySelectorAll("input, select").forEach(control => {
    control.disabled = true;
    control.setAttribute("aria-disabled", "true");
  });
  html.querySelectorAll("textarea").forEach(control => {
    control.readOnly = true;
    control.setAttribute("aria-readonly", "true");
  });
}

/** Convert one named form control into a Foundry document update. */
export function formControlUpdate(control) {
  const { name, type } = control ?? {};
  if (!name || control.disabled || (type === "radio" && !control.checked)) return null;
  const value = type === "checkbox"
    ? control.checked
    : control.multiple
      ? Array.from(control.selectedOptions, option => option.value)
      : control.value ?? control.getAttribute?.("value") ?? "";
  return { [name]: value };
}

/** Persist the shared Notes prose-mirror control through one Actor update. */
export async function persistRichTextChange(sheet, event) {
  if (!sheet?.isEditable) return false;
  const control = event?.currentTarget;
  if (!control?.matches?.("prose-mirror[name]")) return false;
  const update = formControlUpdate(control);
  if (!update) return false;
  await sheet.document.update(update, { render: true });
  return true;
}

/** Bind the shared Notes editor to the sheet's authoritative save handler. */
export function bindRichTextPersistence(sheet, html, listenerOptions) {
  html.querySelectorAll("prose-mirror[name]").forEach(control => {
    // Foundry may normalize the parser-created custom element after _onRender,
    // clearing its internal raw value while leaving the enriched preview intact.
    // Hydrate from the authoritative Document before ProseMirror opens.
    const hydrateValue = () => {
      const documentValue = control.name
        ?.split(".")
        .reduce((value, key) => value?.[key], sheet.document);
      if (typeof documentValue !== "string" || control.value === documentValue) return;
      const preview = control.querySelector?.(".editor-content");
      const enrichedPreview = preview?.innerHTML;
      // Avoid the public setter's synthetic change event: hydration is not a
      // user edit and must never enter the persistence path.
      if (typeof control._setValue === "function") {
        control._setValue(documentValue);
        control._refresh?.();
      } else control.value = documentValue;
      if (!control.open && preview && enrichedPreview !== undefined) preview.innerHTML = enrichedPreview;
    };

    hydrateValue();
    // Foundry can normalize the parser-created custom element after _onRender.
    // Re-hydrate in capture phase immediately before its pencil handler opens
    // ProseMirror, guaranteeing the raw value used by normal edit mode.
    control.addEventListener("click", hydrateValue, { ...listenerOptions, capture: true });

    control.addEventListener(
      "change",
      event => sheet._persistFormControl(event),
      listenerOptions,
    );
  });
}


/** Prevent native submit; the ensuing blur emits the sheet's one change event. */
export function handleActorNameEnter(event) {
  if (event.key !== "Enter" || event.isComposing) return false;
  event.preventDefault();
  event.currentTarget?.blur();
  return true;
}

/** Persist an Actor's root name once and request a Foundry-visible rerender. */
export async function persistActorNameChange(sheet, event) {
  if (!sheet?.isEditable) return false;

  const input = event?.currentTarget;
  const update = formControlUpdate(input);
  if (!update || !Object.hasOwn(update, "name")) return false;

  const name = update.name ?? "";
  if (name === sheet.document.name) return false;

  await sheet.document.update({ name }, { render: true });
  return true;
}


const documentPathQueues = new WeakMap();

/** Serialize read-modify-write interactions for one Document field path. */
export function queueDocumentPathUpdate(document, path, action) {
  if (!document || !path || typeof action !== "function") return Promise.resolve(false);

  let pathQueues = documentPathQueues.get(document);
  if (!pathQueues) {
    pathQueues = new Map();
    documentPathQueues.set(document, pathQueues);
  }

  const previous = pathQueues.get(path) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(action);
  pathQueues.set(path, operation);

  return operation.finally(() => {
    if (pathQueues.get(path) !== operation) return;
    pathQueues.delete(path);
    if (pathQueues.size === 0) documentPathQueues.delete(document);
  });
}
