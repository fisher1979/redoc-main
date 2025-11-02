import * as PropTypes from 'prop-types';
import * as React from 'react';
import { reaction } from 'mobx';

import { ThemeProvider } from '../../styled-components';
import { OptionsProvider } from '../OptionsProvider';

import { AppStore } from '../../services';
import { ApiInfo } from '../ApiInfo/';
import { ApiLogo } from '../ApiLogo/ApiLogo';
import { ContentItems } from '../ContentItems/ContentItems';
import { SideMenu } from '../SideMenu/SideMenu';
import { StickyResponsiveSidebar } from '../StickySidebar/StickyResponsiveSidebar';
import { ApiContentWrap, BackgroundStub, RedocWrap } from './styled.elements';

import { SearchBox } from '../SearchBox/SearchBox';
import { StoreProvider } from '../StoreBuilder';
import { CustomMenu } from '../CustomMenu';
import { SanitizedMarkdownHTML } from '../Markdown/SanitizedMdBlock';
import { Section, Row, MiddlePanel } from '../../common-elements';
import styled from '../../styled-components';

// Full-width MiddlePanel for custom menu content
const FullWidthMiddlePanel = styled(MiddlePanel)`
  width: 100%;
`;

export interface RedocProps {
  store: AppStore;
}

interface RedocState {
  customHtmlContent: string | null;
  customMenuItemLabel: string | null;
}

export class Redoc extends React.Component<RedocProps, RedocState> {
  static propTypes = {
    store: PropTypes.instanceOf(AppStore).isRequired,
  };

  constructor(props: RedocProps) {
    super(props);
    this.state = {
      customHtmlContent: null,
      customMenuItemLabel: null,
    };
  }

  private menuReactionDisposer?: () => void;

  componentDidMount() {
    this.props.store.onDidMount();
    // Listen for custom menu item clicks
    window.addEventListener('custom-menu-item-clicked', this.handleCustomMenuItemClick);

    // Observe menu items activation to clear custom content
    this.menuReactionDisposer = reaction(
      () => {
        // Track if any API menu item is active
        const hasActiveApiItem = this.props.store.menu.items.some(
          item => item.active || this.hasActiveChild(item),
        );
        return hasActiveApiItem;
      },
      hasActiveApiItem => {
        if (hasActiveApiItem && this.state.customHtmlContent) {
          this.setState({ customHtmlContent: null, customMenuItemLabel: null });
        }
      },
    );
  }

  componentWillUnmount() {
    this.props.store.dispose();
    window.removeEventListener('custom-menu-item-clicked', this.handleCustomMenuItemClick);
    if (this.menuReactionDisposer) {
      this.menuReactionDisposer();
    }
  }

  private hasActiveChild(item: any): boolean {
    if (!item.items || item.items.length === 0) return false;
    return item.items.some((child: any) => child.active || this.hasActiveChild(child));
  }

  handleCustomMenuItemClick = (event: Event) => {
    const customEvent = event as CustomEvent<{ item: any; htmlContent: string }>;
    const { item, htmlContent } = customEvent.detail;
    this.setState({
      customHtmlContent: htmlContent,
      customMenuItemLabel: item.label,
    });
    // Deactivate API menu when custom menu item is clicked
    if (this.props.store.menu) {
      this.props.store.menu.items.forEach(menuItem => {
        if (menuItem.active) {
          menuItem.deactivate();
        }
      });
    }
  };

  render() {
    const {
      store: { spec, menu, options, search, marker },
    } = this.props;
    const store = this.props.store;
    const { customHtmlContent } = this.state;
    return (
      <ThemeProvider theme={options.theme}>
        <StoreProvider value={store}>
          <OptionsProvider value={options}>
            <RedocWrap className="redoc-wrap">
              <StickyResponsiveSidebar menu={menu} className="menu-content">
                <ApiLogo info={spec.info} />
                {(!options.disableSearch && (
                  <SearchBox
                    search={search!}
                    marker={marker}
                    getItemById={menu.getItemById}
                    onActivate={menu.activateAndScroll}
                  />
                )) ||
                  null}
                <CustomMenu />
                <SideMenu menu={menu} />
              </StickyResponsiveSidebar>
              <ApiContentWrap className="api-content">
                {!customHtmlContent && <ApiInfo store={store} />}
                {customHtmlContent ? (
                  <Section id="custom-menu-content">
                    <Row>
                      <FullWidthMiddlePanel>
                        <SanitizedMarkdownHTML html={customHtmlContent} />
                      </FullWidthMiddlePanel>
                    </Row>
                  </Section>
                ) : (
                  <ContentItems items={menu.items as any} />
                )}
              </ApiContentWrap>
              {!customHtmlContent && <BackgroundStub />}
            </RedocWrap>
          </OptionsProvider>
        </StoreProvider>
      </ThemeProvider>
    );
  }
}
