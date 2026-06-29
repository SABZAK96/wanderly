document.getElementById("addExp").addEventListener("click", () => {
  document.getElementById("my_modal_expense").showModal();
});

// make all the borders bold when clicked
const allNameBadges = document.querySelectorAll("#exp-payer .badge");
allNameBadges.forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.classList.contains("border-2")
      ? btn.classList.remove("border-2")
      : btn.classList.add("border-2");
  });
});

// enabling custom field when the radio button is checked
const radioGroup = document.querySelectorAll("input[name='radio-2']");
const customInputField = document.getElementById("customInput");
radioGroup.forEach((radio) => {
  radio.addEventListener("change", () => {
    document.getElementById("customRadio").checked
      ? (customInputField.disabled = false)
      : (customInputField.disabled = true);
  });
});

const settleInputs = document.querySelectorAll(
  ".collapse-content input[type='checkbox']",
);

// popping up Mark as settled button when checking the inputs in the settle up section
settleInputs.forEach((field) => {
  field.addEventListener("change", () => {
    //scoping to the currnt accordion only - get the parent of the field we are working through and put all the input fields under that parent in an array
    const allInputsAsArray = [
      ...field
        .closest(".collapse-content")
        .querySelectorAll("input[type='checkbox']"),
    ];
    if (field.checked) {
      field
        .closest(".collapse-content")
        .lastElementChild.classList.remove("hidden");
    }

    const allUnChecked = allInputsAsArray.every(
      (element) => element.checked === false,
    );

    // popping out Mark as settled button when all inputs are unchecked
    if (allUnChecked) {
      field
        .closest(".collapse-content")
        .lastElementChild.classList.add("hidden");
    }
  });
});
