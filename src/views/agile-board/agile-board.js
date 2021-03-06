/* @flow */

import React, {Component} from 'react';
import {View, RefreshControl, TouchableOpacity, ActivityIndicator, Dimensions} from 'react-native';

import {connect} from 'react-redux';
import isEqual from 'react-fast-compare';

import * as boardActions from './board-actions';
import AgileBoardSprint from './agile-board__sprint';
import Api from '../../components/api/api';
import Auth from '../../components/auth/auth';
import BoardHeader from './board-header';
import BoardScroller from '../../components/board-scroller/board-scroller';
import ErrorMessage from '../../components/error-message/error-message';
import log from '../../components/log/log';
import QueryAssistPanel from '../../components/query-assist/query-assist-panel';
import QueryPreview from '../../components/query-assist/query-preview';
import Router from '../../components/router/router';
import Select from '../../components/select/select';
import usage from '../../components/usage/usage';
import {DragContainer} from '../../components/draggable/';
import {flushStoragePart, getStorageState} from '../../components/storage/storage';
import {getScrollableWidth} from '../../components/board-scroller/board-scroller__math';
import {hasType} from '../../components/api/api__resource-types';
import {IconException, IconMagnifyZoom} from '../../components/icon/icon';
import {notify} from '../../components/notification/notification';
import {renderSelector} from './agile-board__renderer';
import {routeMap} from '../../app-routes';
import {SkeletonAgile} from '../../components/skeleton/skeleton';
import {ThemeContext} from '../../components/theme/theme-context';
import {View as AnimatedView} from 'react-native-animatable';

import {HIT_SLOP} from '../../components/common-styles/button';
import {UNIT} from '../../components/variables/variables';
import styles from './agile-board.styles';

import type IssuePermissions from '../../components/issue-permissions/issue-permissions';
import type {AgilePageState} from './board-reducers';
import type {AnyIssue, IssueOnList} from '../../flow/Issue';
import type {CustomError} from '../../flow/Error';
import type {SprintFull, AgileBoardRow, AgileColumn, BoardColumn, BoardOnList, Sprint} from '../../flow/Agile';
import type {Theme, UITheme} from '../../flow/Theme';

const CATEGORY_NAME = 'Agile board';

type Props = AgilePageState & {
  auth: Auth,
  api: Api,
  isLoadingMore: boolean,
  noMoreSwimlanes: boolean,
  sprint: ?SprintFull,
  isSprintSelectOpen: boolean,
  selectProps: Object,
  issuePermissions: IssuePermissions,
  onLoadBoard: (query: string) => any,
  onLoadMoreSwimlanes: (query?: string) => any,
  onRowCollapseToggle: (row: AgileBoardRow) => any,
  onColumnCollapseToggle: (column: AgileColumn) => any,
  onOpenSprintSelect: (any) => any,
  onOpenBoardSelect: (any) => any,
  onCloseSelect: (any) => any,
  createCardForCell: (columnId: string, cellId: string) => any,
  onCardDrop: (any) => any,
  refreshAgile: (agileId: string, sprintId: string, query?: string) => any,
  suggestAgileQuery: (query: ?string, caret: number) => any,
  storeLastQuery: (query: string) => any,
  updateIssue: (issueId: string, sprint?: SprintFull) => any
};

type State = {
  zoomedIn: boolean,
  stickElement: { agile: boolean, boardHeader: boolean },
  offsetY: number,
  showAssist: boolean
};

class AgileBoard extends Component<Props, State> {
  boardHeader: ?BoardHeader;
  query: string;

  constructor(props: Props) {
    super(props);
    this.updateZoomedInStorageState(true);
    this.query = getStorageState().agileQuery || '';

    this.state = {
      zoomedIn: true,
      stickElement: {
        agile: false,
        boardHeader: false
      },
      offsetY: 0,
      showAssist: false
    };

    Router.setOnDispatchCallback((routeName: string, prevRouteName: string, options: Object) => {
      if (routeName === routeMap.AgileBoard && prevRouteName === routeMap.Issue && options?.issueId) {
        options.issueId && this.props.updateIssue(options.issueId, this.props?.sprint);
      }
    });
  }

  componentDidMount() {
    usage.trackScreenView(CATEGORY_NAME);
    this.loadBoard();
  }

  shouldComponentUpdate(nextProps: Props, nextState: State): boolean {
    const isPropsEqual: boolean = isEqual(this.props, nextProps);
    const isStateEqual: boolean = isEqual(this.state, nextState);
    return !isPropsEqual || !isStateEqual;
  }

  componentWillUnmount() {
    boardActions.destroySSE();
  }

  loadBoard = () => {
    this.props.onLoadBoard(this.query);
  }

  onVerticalScroll = (event) => {
    const {nativeEvent} = event;
    const newY = nativeEvent.contentOffset.y;
    const viewHeight = nativeEvent.layoutMeasurement.height;
    const contentHeight = nativeEvent.contentSize.height;
    const maxY = contentHeight - viewHeight;

    if (maxY > 0 && newY > 0 && (maxY - newY) < 40) {
      this.props.onLoadMoreSwimlanes(this.query);
    }

    this.setState({
      stickElement: {
        agile: newY > UNIT * 2,
        boardHeader: newY > UNIT * (this.isSprintDisabled() ? 2 : 14)
      }
    });
  };

  onContentSizeChange = (width, height) => {
    const windowHeight = Dimensions.get('window').height;
    if (height < windowHeight) {
      this.props.onLoadMoreSwimlanes(this.query);
    }
  };

  syncHeaderPosition = (event) => {
    const {nativeEvent} = event;
    if (this.boardHeader) {
      this.boardHeader.setNativeProps({
        style: {left: -nativeEvent.contentOffset.x}
      });
    }
  };

  _renderRefreshControl = (uiTheme: UITheme) => {
    return <RefreshControl
      refreshing={this.props.isLoading}
      tintColor={uiTheme.colors.$link}
      onRefresh={this.loadBoard}
    />;
  }

  _onTapIssue = (issue: IssueOnList) => {
    log.debug(`Opening issue "${issue.id}" from Agile Board`);
    usage.trackEvent(CATEGORY_NAME, 'Open issue');
    Router.Issue({
      issuePlaceholder: issue,
      issueId: issue.id
    });
  };

  _getScrollableWidth = (): number | null => {
    const {sprint} = this.props;

    if (!sprint || !sprint.board || !sprint.board.columns) {
      return null;
    }

    return getScrollableWidth(sprint.board.columns);
  };

  renderAgileSelector(uiTheme: UITheme) {
    const {agile, onOpenBoardSelect} = this.props;
    if (agile) {
      return renderSelector({
        key: agile.id,
        label: agile.name,
        onPress: onOpenBoardSelect,
        style: styles.agileSelector,
        textStyle: styles.agileSelectorText,
        showBottomBorder: this.state.stickElement.agile,
        showLoader: true,
        uiTheme
      });
    }
    return <View style={styles.agileSelector}/>;
  }

  isSprintDisabled(): boolean {
    const {agile} = this.props;
    return agile?.sprintsSettings?.disableSprints === true;
  }

  renderSprintSelector(uiTheme: UITheme) {
    const {agile, sprint, onOpenSprintSelect, isLoading} = this.props;

    if (!agile || !sprint) {
      return null;
    }

    if (this.isSprintDisabled()) {
      return null;
    }
    if (sprint) {
      return renderSelector({
        key: sprint.id,
        label: sprint.name,
        onPress: onOpenSprintSelect,
        style: styles.sprintSelector,
        isLoading,
        uiTheme
      });
    }
  }

  renderZoomButton(uiTheme: UITheme) {
    const {isLoading, isLoadingAgile, sprint} = this.props;
    const {zoomedIn, stickElement} = this.state;

    if (!stickElement.boardHeader && !isLoading && !isLoadingAgile && sprint) {
      return (
        <AnimatedView
          useNativeDriver
          duration={300}
          animation="zoomIn"
          style={styles.zoomButton}
        >
          <TouchableOpacity
            hitSlop={HIT_SLOP}
            onPress={this.toggleZoom}
          >
            <IconMagnifyZoom zoomedIn={zoomedIn} size={24} color={uiTheme.colors.$link}/>
          </TouchableOpacity>
        </AnimatedView>
      );
    }

    return null;
  }

  boardHeaderRef = (instance: ?BoardHeader) => {
    if (instance) {
      this.boardHeader = instance;
    }
  };

  toggleColumn = (column: BoardColumn) => {
    notify(column.collapsed ? 'Column expanded' : 'Column collapsed');
    this.props.onColumnCollapseToggle(column);
  };

  renderBoardHeader() {
    const {zoomedIn} = this.state;
    return (
      <View style={styles.boardHeaderContainer}>
        {this.props.sprint && <BoardHeader
          ref={this.boardHeaderRef}
          style={{minWidth: zoomedIn ? this._getScrollableWidth() : null}}
          columns={this.props.sprint.board?.columns}
          onCollapseToggle={this.toggleColumn}
        />}
      </View>
    );
  }

  updateQuery = (query: ?string) => {
    this.query = query || '';
  };

  _renderSelect() {
    const {selectProps} = this.props;
    return (
      <Select
        getTitle={item => item.name}
        onCancel={this.props.onCloseSelect}
        {...selectProps}
        onSelect={(selected: BoardOnList | Sprint) => {
          if (hasType.agile(selected)) {
            this.updateQuery(null);
          }
          return selectProps.onSelect(selected, this.query);
        }}
      />
    );
  }

  getError(): CustomError | null {
    return this.props.error;
  }

  getAgileError(): string | null {
    const errors: Array<?string> = this.props.agile?.status?.errors || [];
    return errors.length > 0 ? errors.join('\n') : null;
  }

  renderErrors() {
    const error: CustomError | null = this.getError();
    const agileErrors: string | null = this.getAgileError();

    if (error) {
      return <ErrorMessage style={styles.error} error={this.props.error}/>;
    }

    if (agileErrors) {
      return <ErrorMessage
        style={styles.error}
        errorMessageData={{
          title: 'Configuration errors',
          description: agileErrors,
          icon: IconException,
          iconSize: 56
        }}/>;
    }
  }

  canRunCommand = (issue: AnyIssue): boolean => {
    return this.props.issuePermissions.canRunCommand(issue);
  };

  renderSprint = (uiTheme: UITheme) => {
    const {sprint, createCardForCell, onRowCollapseToggle, agile} = this.props;

    return (
      <AgileBoardSprint
        testID="agileBoardSprint"
        sprint={{
          ...sprint,
          agile: sprint?.agile ? {...sprint?.agile, hideOrphansSwimlane: agile?.hideOrphansSwimlane} : agile
        }}
        zoomedIn={this.state.zoomedIn}
        canRunCommand={this.canRunCommand}
        onTapIssue={this._onTapIssue}
        onTapCreateIssue={createCardForCell}
        onCollapseToggle={onRowCollapseToggle}
        uiTheme={uiTheme}
      />
    );
  };

  onDragStart() {
    usage.trackEvent(CATEGORY_NAME, 'Card drag start');
  }

  onDragEnd = (draggingComponent: Object, hitZones: Array<Object>) => {
    const movedId = draggingComponent.data;
    const dropZone = hitZones[0];
    if (!dropZone) {
      return;
    }

    this.props.onCardDrop({
      columnId: dropZone.data.columnId,
      cellId: dropZone.data.cellId,
      leadingId: dropZone.data.issueIds
        .filter(id => id !== movedId)[dropZone.placeholderIndex - 1],
      movedId
    });
  };

  updateZoomedInStorageState(agileZoomedIn: boolean) {
    flushStoragePart({agileZoomedIn});
  }

  toggleZoom = () => {
    const zoomedIn = !this.state.zoomedIn;
    this.setState({zoomedIn});
    this.updateZoomedInStorageState(zoomedIn);
  };

  toggleQueryAssist = (isAssistVisible: boolean = false) => {
    this.setState({showAssist: isAssistVisible});
  };

  onQueryApply = (query: string) => {
    const {refreshAgile, sprint, storeLastQuery} = this.props;
    this.updateQuery(query);
    storeLastQuery(query);
    if (sprint && sprint.agile) {
      refreshAgile(sprint.agile.id, sprint.id, query);
    }
    this.toggleQueryAssist(false);
  };

  onShowAssist = async (clearQuery: boolean) => {
    if (clearQuery) {
      this.query = '';
    }
    this.toggleQueryAssist(true);
  };

  renderSearchPanel = () => {
    const {suggestAgileQuery, queryAssistSuggestions} = this.props;

    return (
      <QueryAssistPanel
        queryAssistSuggestions={queryAssistSuggestions}
        query={this.query}
        suggestIssuesQuery={suggestAgileQuery}
        onQueryUpdate={this.onQueryApply}
        onClose={this.toggleQueryAssist}
        clearButtonMode="always"
      />
    );
  };

  renderSearchPanelPreview = () => {
    return (
      <QueryPreview
        style={styles.searchQueryPreview}
        query={this.query}
        onFocus={this.onShowAssist}
      />
    );
  };

  renderBoard(uiTheme: UITheme) {
    const {sprint, isLoadingMore, error} = this.props;
    const {zoomedIn} = this.state;

    if (!sprint) {
      if (error && error.noAgiles) {
        return null;
      }
      return (
        <View>
          <View style={styles.agileNoSprint}>{this.renderAgileSelector(uiTheme)}</View>
          <SkeletonAgile/>
        </View>
      );
    }

    return (
      <DragContainer onDragStart={this.onDragStart} onDragEnd={this.onDragEnd}>
        <BoardScroller
          columns={sprint?.board?.columns}
          snap={zoomedIn}
          refreshControl={this._renderRefreshControl(uiTheme)}
          horizontalScrollProps={{
            contentContainerStyle: {
              display: 'flex',
              flexDirection: 'column',
              width: zoomedIn ? this._getScrollableWidth() : '100%'
            },
            onScroll: this.syncHeaderPosition
          }}
          verticalScrollProps={{
            onScroll: this.onVerticalScroll,
            onContentSizeChange: this.onContentSizeChange,
            contentContainerStyle: {
              minHeight: '100%'
            }
          }}

          agileSelector={this.renderAgileSelector(uiTheme)}
          sprintSelector={this.renderSprintSelector(uiTheme)}
          boardHeader={this.renderBoardHeader()}
          boardSearch={this.renderSearchPanelPreview()}

        >

          {this.renderSprint(uiTheme)}
          {isLoadingMore && <ActivityIndicator color={uiTheme.colors.$link} style={styles.loadingMoreIndicator}/>}

        </BoardScroller>
      </DragContainer>
    );
  }

  render() {
    const {isSprintSelectOpen} = this.props;

    return (
      <ThemeContext.Consumer>
        {(theme: Theme) => {
          const uiTheme: UITheme = theme.uiTheme;
          return (
            <View
              testID="pageAgile"
              style={styles.agile}
            >

              {this.renderZoomButton(uiTheme)}

              {this.renderBoard(uiTheme)}

              {this.renderErrors()}

              {isSprintSelectOpen && this._renderSelect()}

              {this.state.showAssist && this.renderSearchPanel()}

            </View>
          );
        }}
      </ThemeContext.Consumer>
    );
  }
}


const mapStateToProps = (state, ownProps) => {
  return {
    ...state.agile,
    ...state.app
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    onLoadBoard: (query: string) => dispatch(boardActions.loadDefaultAgileBoard(query)),
    onLoadMoreSwimlanes: (query?: string) => dispatch(boardActions.fetchMoreSwimlanes(query)),
    onRowCollapseToggle: (row) => dispatch(boardActions.rowCollapseToggle(row)),
    onColumnCollapseToggle: (column) => dispatch(boardActions.columnCollapseToggle(column)),
    onOpenSprintSelect: () => dispatch(boardActions.openSprintSelect()),
    onOpenBoardSelect: () => dispatch(boardActions.openBoardSelect()),
    onCloseSelect: () => dispatch(boardActions.closeSelect()),
    createCardForCell: (...args) => dispatch(boardActions.createCardForCell(...args)),
    onCardDrop: (...args) => dispatch(boardActions.onCardDrop(...args)),
    refreshAgile: (agileId: string, sprintId: string, query: string = '') => dispatch(boardActions.refreshAgile(agileId, sprintId, query)),
    suggestAgileQuery: (query: string, caret: number) => dispatch(boardActions.suggestAgileQuery(query, caret)),
    storeLastQuery: (query: string) => dispatch(boardActions.storeLastQuery(query)),
    updateIssue: (issueId: string, sprint?: SprintFull) => dispatch(boardActions.updateIssue(issueId, sprint)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(AgileBoard);
