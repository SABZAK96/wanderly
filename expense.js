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

// removing the paid debts when mark as settled is clicked
let settledAmounts = 0;

const allMarkAsSettledBtns = document.querySelectorAll(".settle");

allMarkAsSettledBtns.forEach((btn) => {
  const debtNode = btn.closest(".collapse").querySelector(".owed");

  btn.addEventListener("click", () => {
    let debt = Number(debtNode.textContent);

    // go to the parent node and get all the input fields and put them in the array
    const amounts = [
      ...btn
        .closest(".collapse-content")
        .querySelectorAll("input[type='checkbox']"),
    ];

    amounts.forEach((amount) => {
      if (amount.checked) {
        const paidAmount = Number(amount.previousElementSibling.textContent);
        settledAmounts += paidAmount;
        amount.parentElement.parentElement.remove();
      }
    });

    const remainingDebt = debt - settledAmounts;
    debtNode.innerHTML = remainingDebt;
    settledAmounts = 0;

    //clear out the cards if the debt is zero
    const allDebts = document.querySelectorAll(".owed");
    allDebts.forEach((debt) => {
      if (Number(debt.textContent) === 0) {
        debt.closest(".collapse").remove();
      }
    });
  });
});

//================================================================================================
// add an expense logic in modal
//================================================================================================

// first update the table with added row
document.getElementById("exp-submit").addEventListener("click", () => {
  const titleInput = document.getElementById("exp-title");
  const costInput = document.getElementById("exp-cost");
  const expenseTitle = titleInput.value;
  const costAmount = costInput.value;
  const Allbadges = document.querySelectorAll("#exp-payer span");

  let selectedBadges = [...Allbadges];
  //save the result of the filter back to the variable - otherwise it will be thorwn away
  selectedBadges = selectedBadges.filter((badge) =>
    badge.classList.contains("border-2"),
  );
  console.log(selectedBadges);

  const tableBody = document.querySelector("#my_table tbody");
  let newTableRow = "";
  newTableRow = `  <tr>
    <td class="font-medium " contenteditable="true">${expenseTitle}</td>
    <td  contenteditable="true"><span>$</span>${costAmount}</td>
    <td><div class="flex flex-wrap gap-1 badgePlaceHolder"></div></td>
    <td > <button
                      class="btn btn-ghost btn-xs text-error"
                      onclick="this.closest('tr').remove()"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                        />
                      </svg>
                    </button></td>
  </tr>`;

  tableBody.insertAdjacentHTML("beforeend", newTableRow);
  const badgePlaceholder = tableBody.querySelector(".badgePlaceHolder");

  // cloneNode(true) so original badges stay in the modal for next time
  selectedBadges.forEach((badge) => {
    badgePlaceholder.appendChild(badge.cloneNode(true));
  });

  // clearing the modal for the next use

  titleInput.value = "";
  costInput.value = "";
  document.getElementById("my_modal_expense").close();
});
