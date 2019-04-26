
function findTriggerElementWithLabel(labelRegex) {
    return [...this.element.querySelectorAll('.cs-toolbox-section label')].find(element => labelRegex.test(element.textContent));
}
  
function findInputWithValue(value) {
    return Array.from(this.element.querySelectorAll('input'))
        .find(element => element.value === value);
}

export {
    findTriggerElementWithLabel,
    findInputWithValue
}