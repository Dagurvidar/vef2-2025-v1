const checkAnsButton = document.querySelector(".checkAnsButton");
checkAnsButton.addEventListener("click", () => checkAnswers());

function checkAnswers() {
  const inputs = document.querySelectorAll("input[type='radio']");
  inputs.forEach((option) => {
    const label = document.querySelector(`label[for='${option.id}']`);
    label.classList.remove("correct-answer", "wrong-answer");
  });

  inputs.forEach((input) => {
    if (input.checked) {
      const label = document.querySelector(`label[for='${input.id}']`);
      if (input.getAttribute("data-correct") === "true") {
        label.classList.add("correct-answer");
      } else {
        label.classList.add("wrong-answer");
      }
    }
  });
}
