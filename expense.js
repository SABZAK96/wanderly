document.getElementById("addExp").addEventListener("click", () => {
  document.getElementById("my_modal_expense").showModal();
});

// pre-select All badge in the who owes the payer section
function initAllBadge(id) {
  const allBadge = document.getElementById("allBadge");
  const container = document.getElementById(id);
  const nameBadges = [...container.querySelectorAll(".badge")].filter(
    (badge) => badge !== allBadge,
  );
  allBadge.classList.add("border-2");
  nameBadges.forEach((nameBadge) => {
    nameBadge.addEventListener("click", () => {
      allBadge.classList.remove("border-2");

      //re-select allBadge if nothing else is selected
      if (
        nameBadges.every(
          (nameBadge) => !nameBadge.classList.contains("border-2"),
        )
      ) {
        allBadge.classList.add("border-2");
      }
      if (customRadio.checked) popBadgesInCustom();
    });
  });

  //if allBadge is clicked again, de-select other badges
  allBadge.addEventListener("click", () => {
    !allBadge.classList.contains("border-2") &&
      allBadge.classList.add("border-2");
    nameBadges.forEach(
      (badge) =>
        badge.classList.contains("border-2") &&
        badge.classList.remove("border-2"),
    );
    if (customRadio.checked) popBadgesInCustom();
  });
}

// make all the borders bold when clicked
function highlightBadges(id) {
  const allNameBadges = document.querySelectorAll(`#${id} .badge`);
  allNameBadges.forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.contains("border-2")
        ? btn.classList.remove("border-2")
        : btn.classList.add("border-2");
      if (customRadio.checked) popBadgesInCustom();
    });
  });
}

highlightBadges("exp-payer");
highlightBadges("debt-payer");
initAllBadge("debt-payer");

// popping custom field when the radio button is checked
const radioGroup = document.querySelectorAll("input[name='radio-2']");
const customInputField = document.getElementById("customAmount");
const customRadio = document.getElementById("customRadio");
radioGroup.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (customRadio.checked) {
      customInputField.classList.remove("hidden");

      // run here, after the user has made selections
      popBadgesInCustom();
    } else {
      customInputField.classList.add("hidden");
    }
  });
});

// adding selected badges below custom field based on the selected badge
function popBadgesInCustom() {
  const container = document.getElementById("debt-payer");
  const customAmountContainer = document.getElementById("customAmount");
  let containerArray = [...container.querySelectorAll(".badge")];
  customAmountContainer.innerHTML = "";

  containerArray = containerArray.filter((element) =>
    element.classList.contains("border-2"),
  );
  //logic for allBadge
  if (containerArray.find((element) => element.id === "allBadge")) {
    const allNames = [...container.querySelectorAll(".badge")].filter(
      (badge) => badge.id !== "allBadge",
    );
    populateRows(allNames);
  }
  // logic for selecting nameBadges
  else {
    populateRows(containerArray);
  }
}

//function for adding rows to custom amount field
function populateRows(myArray) {
  const customAmountContainer = document.getElementById("customAmount");
  myArray.forEach((element) => {
    const row = document.createElement("div");
    row.className = "flex flex-row items-center justify-between";

    const badgeClone = element.cloneNode(true);

    const input = document.createElement("input");
    input.type = "number";
    input.placeholder = "Amount";
    input.className = "input input-xs max-w-[100px] max-h-15 customInput";
    input.dataset.name = element.dataset.name;

    row.appendChild(badgeClone);
    row.appendChild(input);
    customAmountContainer.appendChild(row);
  });
}
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
  let expenseTitle = titleInput.value;
  let costAmount = costInput.value;
  const Allbadges = document.querySelectorAll("#exp-payer span");
  const errorMsg = document.getElementById("errorMsg");

  let selectedBadges = [...Allbadges];
  //save the result of the filter back to the variable - otherwise it will be thorwn away
  selectedBadges = selectedBadges.filter((badge) =>
    badge.classList.contains("border-2"),
  );
  console.log(selectedBadges);

  //validate the fields are filled
  if (titleInput.value.trim() === "") {
    titleInput.classList.add("border-2", "border-red-500");
    return;
  }
  titleInput.classList.contains("border-red-500") &&
    titleInput.classList.remove("border-2", "border-red-500");

  if (costInput.value === "" || costInput.value === "0") {
    costInput.classList.add("border-2", "border-red-500");
    return;
  }
  costInput.classList.contains("border-red-500") &&
    costInput.classList.remove("border-2", "border-red-500");
  if (selectedBadges.length === 0) {
    errorMsg.classList.remove("hidden");
    errorMsg.textContent = "* Please Select the Payers!";
    return;
  }
  errorMsg.textContent = "";
  errorMsg.classList.add("hidden");

  //cleaning the values to have a good look in the UI
  expenseTitle = expenseTitle.trim();
  expenseTitle = expenseTitle.charAt(0).toUpperCase() + expenseTitle.slice(1);
  costAmount = Number(costAmount).toLocaleString("en-US");

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

  //pick the lastly added element with class badgePlaceHolder - .at(-1) gets the last element in the array
  const badgePlaceholder = [
    ...tableBody.querySelectorAll(".badgePlaceHolder"),
  ].at(-1);

  // cloneNode(true) so original badges stay in the modal for next time
  selectedBadges.forEach((badge) => {
    badgePlaceholder.appendChild(badge.cloneNode(true));
  });

  // clearing the modal for the next use

  titleInput.value = "";
  costInput.value = "";
  Allbadges.forEach((badge) => {
    badge.classList.contains("border-2") && badge.classList.remove("border-2");
  });
  document.getElementById("my_modal_expense").close();
});
