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
