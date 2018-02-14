import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  Animated,
  TextInput,
  ListView
} from 'react-native';

const MAX_EXPECTED_AUTO_CORRECT_DIFFERENCE = 10;

export class MentionsTextInput extends Component {
  constructor(props) {
    super(props);

    this.state = {
      textInputHeight: '',
      suggestionsPanelHeight: new Animated.Value(0),
      text: this.props.value ? this.props.value : '',
      selection: {start: 0, end: 0},
    }

    this.lastTextLength = 0;
    this.triggerMatrix = [];
    this.isTrackingStarted = false;
  }

  componentWillMount() {
    this.setState({
      textInputHeight: this.props.textInputMinHeight
    })
  }

  componentWillReceiveProps(nextProps) {
    if (!nextProps.value) {
      this.resetTextbox();
    }
  }

  resetTextbox() {
    this.setState({ textInputHeight: this.props.textInputMinHeight });
  }

  openSuggestionsPanel() {
    if (this.props.onOpenSuggestionsPanel) {
      this.props.onOpenSuggestionsPanel();
    }

    Animated.spring(this.state.suggestionsPanelHeight, {
      duration: 100,
      toValue: this.props.suggestionsPanelHeight,
      friction: 4,
    }).start();
  }

  closeSuggestionsPanel() {
    if (this.props.onCloseSuggestionsPanel) {
      this.props.onCloseSuggestionsPanel();
    }

    Animated.timing(this.state.suggestionsPanelHeight, {
      toValue: 0,
      duration: 100,
    }).start();
  }

  updateSuggestions(lastKeyword) {
    this.props.triggerCallback(lastKeyword);
  }

  handleDeleteTriggerOnBackspace(position = 0, index = -2) {
    if (!this.triggerMatrix || !this.triggerMatrix.length) {
      return;
    }

    if (index === -2) {
      index = this.getSubsequentTriggerIndex(position);
    }

    const isAtEnd = position === this.state.text.length - 1;
    const isAtEndOfTrigger = this.triggerMatrix[index][1] === position;
    const isFollowedBySpace = this.state.text[position + 1] === ' ';

    this.shouldDeleteTriggerOnBackspace = (!this.isTrackingStarted && isAtEnd)
                                       || (isAtEndOfTrigger && (isAtEnd || isFollowedBySpace));
  }

  handleClick(position) {
    if (!this.triggerMatrix || !this.triggerMatrix.length) {
      return;
    }

    const index = this.getSubsequentTriggerIndex(position);
    this.handleDeleteTriggerOnBackspace(position, index);

    if (this.isPositionWithinTrigger(position, index)) {
      this.startTracking(position, index);
      return;
    }

    if (position === -1 || this.state.text && this.state.text[position] === ' ') {
      this.stopTracking();
    }
  }

  identifyKeyword(val) {
    if (this.isTrackingStarted) {
      const boundary = this.props.triggerLocation === 'new-word-only' ? 'B': '';
      const delay = this.props.triggerDelay ? this.props.triggerDelay : 0;
      const pattern = new RegExp(`\\${boundary}${this.props.trigger}[a-z0-9_-]{${delay},}`, `gi`);
      const keywordArray = val.match(pattern);
      if (keywordArray && !!keywordArray.length) {
        const lastKeyword = keywordArray[keywordArray.length - 1];
        this.updateSuggestions(lastKeyword);
        this.openSuggestionsPanel();
      } else {
        this.closeSuggestionsPanel();
      }
    }
  }

  updateTriggerMatrixIndex(position) {
    if (!this.triggerMatrix || !this.triggerMatrix.length || !this.isTrackingStarted) {
      return;
    }

    const index = this.triggerMatrixIndex;
    if (index === -1 || index >= this.triggerMatrix.length) {
      return;
    }

    const pattern = new RegExp(`${this.props.trigger}[a-z0-9_-]*`, `gi`);
    const triggerText = this.state.text.slice(this.triggerMatrix[index][0], this.triggerMatrix[index][1] + MAX_EXPECTED_AUTO_CORRECT_DIFFERENCE);
    const keywordArray = triggerText.match(pattern);

    if (keywordArray && !!keywordArray.length) {
      const keyword = keywordArray[0];
      this.triggerMatrix[index][1] = this.triggerMatrix[index][0] + keyword.length - 1;
    }
  }

  stopTracking() {
    this.closeSuggestionsPanel();
    this.isTrackingStarted = false;
  }

  getSubsequentTriggerIndex(position, start = 0, end = Number.MAX_SAFE_INTEGER, lastBiggerIndex = -1) {
    if (!this.triggerMatrix || !this.triggerMatrix.length || start > end) {
      return lastBiggerIndex;
    }

    if (lastBiggerIndex == -1) {
      lastBiggerIndex = this.triggerMatrix.length - 1;
    }

    if (end === Number.MAX_SAFE_INTEGER) {
      end = this.triggerMatrix.length - 1;
    }


    if (start == end) {
      return this.triggerMatrix[start][0] <= position && position <= this.triggerMatrix[start][1] ? start : lastBiggerIndex;
    }

    const middle = Math.trunc((start + end) / 2);
    if (this.triggerMatrix[middle][0] <= position && position <= this.triggerMatrix[middle][1]) {
      return middle;

    } else if (this.triggerMatrix[middle][1] < position) {
      return this.getSubsequentTriggerIndex(position, middle + 1, end, lastBiggerIndex);

    } else {
      return this.getSubsequentTriggerIndex(position, start, middle - 1, middle);
    }
  }

  isPositionWithinTrigger(position = 0, index = 0) {
    return this.triggerMatrix && this.triggerMatrix.length && this.triggerMatrix[index][0] <= position && position <= this.triggerMatrix[index][1];
  }

  isPositionAfterBiggestTrigger(position = 0, index = 0) {
    return !this.triggerMatrix || !this.triggerMatrix.length || this.triggerMatrix[index][1] < position && index === this.triggerMatrix.length - 1;
  }

  isPositionBeforeNextTrigger(position = 0, index = 0) {
    return !this.triggerMatrix || !this.triggerMatrix.length || position < this.triggerMatrix[index][0];
  }

  isTriggerMatrixEmpty(index = 0) {
    return index === -1;
  }

  startTracking(position, index = -2) {
    this.isTrackingStarted = true;

    if (index === -2) {
      index = this.getSubsequentTriggerIndex(position);
    }

    if (this.isTriggerMatrixEmpty(index)) {
      this.triggerMatrix = [[position, position]];
      this.triggerMatrixIndex = 0;

    } else if (this.isPositionBeforeNextTrigger(position, index)) {
      this.triggerMatrix.splice(index, 0, [position, position]);
      this.triggerMatrixIndex = index;

    } else if (this.isPositionAfterBiggestTrigger(position, index)) {
      this.triggerMatrix.push([position, position]);
      this.triggerMatrixIndex = this.triggerMatrix.length - 1;

    } else if (this.isPositionWithinTrigger(position, index)) {
      this.triggerMatrixIndex = index;
    }
  }

  handleTriggerMatrixShiftRight(position, index) {
    if (this.isPositionAfterBiggestTrigger(position, index)) {
      return;
    }

    for (let i = index; i < this.triggerMatrix.length; i++) {
      if (this.isPositionWithinTrigger(position - 1, i)) {
        continue;
      }

      this.triggerMatrix[i][0] += this.getTextDifference();
      this.triggerMatrix[i][1] += this.getTextDifference();
    }
  }

  deleteTriggerKeyword(index, addSpace) {
    const start = this.triggerMatrix[index][0];
    const end = this.triggerMatrix[index][1];

    if (start >= end) {
      return;
    }

    const preTriggerText = this.state.text.slice(0, start + 1);
    const postTriggerText = this.state.text.slice(end, this.state.text.length);
    const space = postTriggerText.length && addSpace ? ' ' : '';

    this.handleTriggerDeletion(index);

    setTimeout(() => {
      this.didTextChange = true;
      this.didDeleteTriggerKeyword = true;
      this.shouldDeleteTriggerOnBackspace = false;
      this.handleTriggerMatrixShiftLeft(start - 1, this.getSubsequentTriggerIndex(start), 1);
      this.setState({ text: preTriggerText + space + postTriggerText }, () => {
        this.startTracking(start);
      });
    }, 50);
  }

  handleTriggerDeletion(index) {
    this.isTriggerDeleted = true;
    this.triggerMatrix.splice(index, 1);
  }

  handleTriggerMatrixShiftLeft(position, index, difference = -this.getTextDifference()) {
    if (!this.triggerMatrix || this.triggerMatrix.length <= index || this.isPositionAfterBiggestTrigger(position, index)) {
      return;
    }

    if (!this.didDeleteTriggerKeyword) {
      if (position === this.triggerMatrix[index][0] - 1) {
        this.handleTriggerDeletion(index);
        if (this.triggerMatrix.length <= index) {
          return;
        }
      }
    } else {
      this.didDeleteTriggerKeyword = false;
    }

    if (this.shouldDeleteTriggerOnBackspace) {
      this.deleteTriggerKeyword(index);
      return;
    }

    for (let i = index; i < this.triggerMatrix.length; i++) {
      if (this.isPositionWithinTrigger(position, i)) {
        continue;
      }

      this.triggerMatrix[i][0] -= difference;
      this.triggerMatrix[i][1] -= difference;
    }
  }

  getTextDifference() {
    return this.state.text.length - this.lastTextLength;
  }

  handleTriggerMatrixChanges(position) {
    if (!this.triggerMatrix || !this.triggerMatrix.length || this.getTextDifference() == 0) {
      return;
    }

    const index = this.getSubsequentTriggerIndex(position);
    if (index === -1 || index >= this.triggerMatrix.length) {
      return;
    }

    if (this.getTextDifference() < 0) {
      this.handleTriggerMatrixShiftLeft(position, index);
    } else {
      this.handleTriggerMatrixShiftRight(position, index);
      this.shouldDeleteTriggerOnBackspace = false;
    }
  }

  handleTyping(position) {
    const lastChar = this.state.text[position];
    const wordBoundary = (this.props.triggerLocation === 'new-word-only') ? position === 0 || this.state.text[position - 1] === ' ' : true;

    this.handleTriggerMatrixChanges(position);
    this.handleDeleteTriggerOnBackspace(position);

    if (this.isTriggerDeleted) {
      this.stopTracking();

    } else if (!this.isTrackingStarted && lastChar === this.props.trigger && wordBoundary) {
      this.startTracking(position);

    } else if (this.isTrackingStarted && (lastChar === ' ' || this.state.text === '')) {
      this.stopTracking();

    } else if (this.isTrackingStarted) {
      this.updateTriggerMatrixIndex(position);
    }

    this.identifyKeyword(this.state.text);
  }

  onSelectionChange(selection) {
    this.setState({ selection });

    if (this.didTextChange && selection.start === selection.end) {
      this.handleTyping(selection.start - 1);

    } else if (selection.start === selection.end) {
      this.handleClick(selection.start - 1);

    } else {
      // cursor selecting chars from selection.start to selection.end
    }

    this.didTextChange = false;
    this.isTriggerDeleted = false;
    this.lastTextLength = this.state.text.length;
  }

  onChangeText(text) {
    this.props.onChangeText(text);
    this.didTextChange = true;
    this.setState({ text });
  }

  render() {
    return (
      <View>
        <Animated.View style={[{ ...this.props.suggestionsPanelStyle }, { height: this.state.suggestionsPanelHeight }]}>
          <ListView
            keyboardShouldPersistTaps={"always"}
            horizontal={true}
            enableEmptySections={true}
            dataSource={this.props.suggestionsDataSource}
            renderRow={(rowData) => { return this.props.renderSuggestionsRow(rowData, this.stopTracking.bind(this)) } }
            />
        </Animated.View>

        <TextInput
          {...this.props}
          onChange={(event) => {
            this.setState({
              textInputHeight: this.props.textInputMinHeight >= event.nativeEvent.contentSize.height ? this.props.textInputMinHeight : event.nativeEvent.contentSize.height,
            });
          } }
          ref={component => this._textInput = component}
          onChangeText={this.onChangeText.bind(this)}
          selection={this.state.selection}
          onSelectionChange={(event) => { this.onSelectionChange(event.nativeEvent.selection); }}
          multiline={true}
          value={this.state.text}
          style={[{ ...this.props.textInputStyle }, { height: Math.min(this.props.textInputMaxHeight, this.state.textInputHeight) }]}
          placeholder={'Write a comment...'}
          />
      </View>
    )
  }
}
