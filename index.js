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

export class MentionsTextInput extends Component {
  constructor() {
    super();
    this.state = {
      textInputHeight: "",
      suggestionsPanelHeight: new Animated.Value(0),

    }

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

  getSucceedingTriggerIndex(position, start = 0, end = Number.MAX_SAFE_INTEGER, lastBiggerIndex = -1) {
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
      return this.getSucceedingTriggerIndex(position, middle + 1, end, lastBiggerIndex);
    } else {
      return this.getSucceedingTriggerIndex(position, start, middle - 1, middle);
    }
  }

  startTracking(start) {
    this.isTrackingStarted = true;
    const index = this.getSucceedingTriggerIndex(start);
    if (index === -1) {
      this.triggerMatrix = [[start, start]];
      this.triggerMatrixIndex = 0;
    } else if (start < this.triggerMatrix[index][0]) {
      this.triggerMatrix.splice(index, 0, [start, start]);
      this.triggerMatrixIndex = index;
    } else if (this.triggerMatrix[index][1] < start && index === this.triggerMatrix.length - 1) {
      this.triggerMatrix.push([start, start]);
      this.triggerMatrixIndex = this.triggerMatrix.length - 1;
    } else {
      this.triggerMatrixIndex = index;
    }
  }

  stopTracking() {
    this.closeSuggestionsPanel();
    this.isTrackingStarted = false;
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

  isTriggerDeleted(cursor) {
    return false;
  }

  handleTriggerDeletion(cursor) {
  }

  updateSuggestions(lastKeyword) {
    this.props.triggerCallback(lastKeyword);
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

  onChangeText(text) {
    this.props.onChangeText(text);
    this.text = text;
    this.didTextChange = true;
  }

  onSelectionChange(selection) {
    if (this.didTextChange && selection.start === selection.end) {
      // typed to move cursor
      const cursor = selection.start;
      const lastChar = this.text[cursor - 1];
      const wordBoundary = (this.props.triggerLocation === 'new-word-only') ? cursor - 1 === 0 || this.text[cursor - 2] === ' ' : true;
      if (lastChar === this.props.trigger && wordBoundary) {
        this.startTracking(cursor);
      } else if (this.isTrackingStarted && (lastChar === ' ' || this.text === '')) {
        this.stopTracking();
      } else if (this.isTriggerDeleted(cursor)) {
        this.stopTracking();
        this.handleTriggerDeletion(cursor);
      }

      this.identifyKeyword(this.text);
    } else if (selection.start === selection.end) {
      // clicked to move cursor
    } else {
      // cursor selecting chars from selection.start to selection.end
    }
  }

  resetTextbox() {
    this.setState({ textInputHeight: this.props.textInputMinHeight });
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
          onSelectionChange={(event) => { this.onSelectionChange(event.nativeEvent.selection); }}
          multiline={true}
          value={this.props.value}
          style={[{ ...this.props.textInputStyle }, { height: Math.min(this.props.textInputMaxHeight, this.state.textInputHeight) }]}
          placeholder={'Write a comment...'}
          />
      </View>
    )
  }
}
