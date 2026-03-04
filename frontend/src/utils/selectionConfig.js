export const selectionOptions = {
  createHandle: (group, p, index, pointArr, handleName) => {
    // Create a rectangle handle (10x10) centered at the point
    // The class 'svg_select_handle' is added by the library to the returned element?
    // Actually, looking at svg.select.js source (or typical behavior), it might add classes to the group or the element.
    // But usually we should add the class if we want to inherit the styles.
    // The user's CSS targets .svg_select_handle.
    // Let's add the class explicitly to be safe, although the library might do it.

    if (handleName === "rot") {
      return group
        .circle(10)
        .addClass("svg_select_handle_rot")
        .center(p[0], p[1])
    }

    return group.rect(8, 8).addClass("svg_select_handle").center(p[0], p[1])
  },
  updateHandle: (group, p, index, pointArr, handleName) => {
    return group.center(p[0], p[1])
  },
  rotationPoint: true,
}
