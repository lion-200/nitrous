/* eslint react/prop-types: 0 */
import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router';
import tt from 'counterpart';
import TransferHistoryRow from 'app/components/cards/TransferHistoryRow';
import TransactionError from 'app/components/elements/TransactionError';
import TimeAgoWrapper from 'app/components/elements/TimeAgoWrapper';
import { numberWithCommas, pricePerSteem } from 'app/utils/StateFunctions';
import shouldComponentUpdate from 'app/utils/shouldComponentUpdate';
import Tooltip from 'app/components/elements/Tooltip';
import { FormattedHTMLMessage } from 'app/Translator';
import {
    LIQUID_TOKEN,
    LIQUID_TOKEN_UPPERCASE,
    VESTING_TOKEN,
} from 'app/client_config';
import * as transactionActions from 'app/redux/TransactionReducer';
import * as globalActions from 'app/redux/GlobalReducer';
import DropdownMenu from 'app/components/elements/DropdownMenu';

class UserWallet extends React.Component {
    constructor() {
        super();
        this.state = {
            claimInProgress: false,
        };
        this.onShowDepositSteem = e => {
            if (e && e.preventDefault) e.preventDefault();
            const name = this.props.current_user.get('username');
            const new_window = window.open();
            new_window.opener = null;
            new_window.location =
                'https://blocktrades.us/?input_coin_type=eth&output_coin_type=steem&receive_address=' +
                name;
        };
        this.onShowWithdrawSteem = e => {
            e.preventDefault();
            const new_window = window.open();
            new_window.opener = null;
            new_window.location =
                'https://blocktrades.us/unregistered_trade/steem/eth';
        };
        this.onShowDepositPower = (current_user_name, e) => {
            e.preventDefault();
            const new_window = window.open();
            new_window.opener = null;
            new_window.location =
                'https://blocktrades.us/?input_coin_type=eth&output_coin_type=steem_power&receive_address=' +
                current_user_name;
        };
        this.shouldComponentUpdate = shouldComponentUpdate(this, 'UserWallet');
    }

    handleClaimRewards = account => {
        this.setState({ claimInProgress: true }); // disable the claim button
        this.props.claimRewards(account);
    };
    render() {
        const {
            onShowDepositSteem,
            onShowWithdrawSteem,
            onShowDepositPower,
        } = this;
        const { account, current_user, gprops } = this.props;

        // do not render if account is not loaded or available
        if (!account) return null;

        const tokenBalances = account.has('token_balances')
            ? account.get('token_balances').toJS()
            : {
                  balance: '0',
                  stake: '0',
                  pendingUnstake: '0',
              };
        const balance = tokenBalances.balance;
        const stakeBalance = tokenBalances.stake;
        const pendingUnstakeBalance = tokenBalances.pendingUnstake;

        let isMyAccount =
            current_user &&
            current_user.get('username') === account.get('name');

        const disabledWarning = false;

        const showTransfer = (asset, transferType, e) => {
            e.preventDefault();
            this.props.showTransfer({
                to: isMyAccount ? null : account.get('name'),
                asset,
                transferType,
            });
        };

        const unstake = (cancel, e) => {
            e.preventDefault();
            const name = account.get('name');
            if (cancel) {
                const unstakeBalance = cancel ? 0 : stakeBalance;
                this.setState({ toggleDivestError: null });
                const errorCallback = e2 => {
                    this.setState({ toggleDivestError: e2.toString() });
                };
                const successCallback = () => {
                    this.setState({ toggleDivestError: null });
                };
                this.props.withdrawVesting({
                    account: name,
                    unstakeBalance,
                    errorCallback,
                    successCallback,
                });
            } else {
                const to_withdraw = account.get('to_withdraw');
                const withdrawn = account.get('withdrawn');
                this.props.showUnstake({
                    account: name,
                    to_withdraw,
                    withdrawn,
                    stakeBalance,
                });
            }
        };

        const divesting =
            parseFloat(account.get('vesting_withdraw_rate').split(' ')[0]) >
            0.0;

        /// transfer log
        let idx = 0;
        const transfer_log = account
            .get('transfer_history')
            .map(item => {
                const data = item.getIn([1, 'op', 1]);
                const type = item.getIn([1, 'op', 0]);

                // Filter out rewards
                if (
                    type === 'curation_reward' ||
                    type === 'author_reward' ||
                    type === 'comment_benefactor_reward'
                ) {
                    return null;
                }

                if (
                    data.sbd_payout === '0.000 SBD' &&
                    data.vesting_payout === '0.000000 VESTS'
                )
                    return null;
                return (
                    <TransferHistoryRow
                        key={idx++}
                        op={item.toJS()}
                        context={account.get('name')}
                    />
                );
            })
            .filter(el => !!el)
            .reverse();

        let balance_menu = [
            {
                value: tt('userwallet_jsx.transfer'),
                link: '#',
                onClick: showTransfer.bind(
                    this,
                    LIQUID_TOKEN_UPPERCASE,
                    'Transfer to Account'
                ),
            },
            {
                value: tt('userwallet_jsx.power_up'),
                link: '#',
                onClick: showTransfer.bind(
                    this,
                    VESTING_TOKEN,
                    'Transfer to Account'
                ),
            },
        ];
        let power_menu = [
            {
                value: tt('userwallet_jsx.power_down'),
                link: '#',
                onClick: unstake.bind(this, false),
            },
        ];
        if (divesting) {
            power_menu.push({
                value: 'Cancel Unstake',
                link: '#',
                onClick: unstake.bind(this, true),
            });
        }

        const balance_str = numberWithCommas(balance);
        const stake_balance_str = numberWithCommas(stakeBalance);
        const pending_unstake_balance_str = numberWithCommas(
            pendingUnstakeBalance
        );

        const reward_steem =
            parseFloat(account.get('reward_steem_balance').split(' ')[0]) > 0
                ? account.get('reward_steem_balance')
                : null;
        const reward_sp =
            parseFloat(account.get('reward_vesting_steem').split(' ')[0]) > 0
                ? account.get('reward_vesting_steem').replace('STEEM', 'SP')
                : null;

        let rewards = [];
        if (reward_steem) rewards.push(reward_steem);
        if (reward_sp) rewards.push(reward_sp);

        let rewards_str;
        switch (rewards.length) {
            case 3:
                rewards_str = `${rewards[0]}, ${rewards[1]} and ${rewards[2]}`;
                break;
            case 2:
                rewards_str = `${rewards[0]} and ${rewards[1]}`;
                break;
            case 1:
                rewards_str = `${rewards[0]}`;
                break;
        }

        let claimbox;
        if (current_user && rewards_str && isMyAccount) {
            claimbox = (
                <div className="row">
                    <div className="columns small-12">
                        <div className="UserWallet__claimbox">
                            <span className="UserWallet__claimbox-text">
                                Your current rewards: {rewards_str}
                            </span>
                            <button
                                disabled={this.state.claimInProgress}
                                className="button"
                                onClick={e => {
                                    this.handleClaimRewards(account);
                                }}
                            >
                                {tt('userwallet_jsx.redeem_rewards')}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="UserWallet">
                {claimbox}
                <div className="row">
                    <div className="columns small-10 medium-12 medium-expand">
                        <div>
                            <br />
                            <h4>{tt('g.balances')}</h4>
                            <br />
                        </div>
                    </div>
                </div>
                <div className="UserWallet__balance row">
                    <div className="column small-12 medium-8">
                        {LIQUID_TOKEN_UPPERCASE}
                        <FormattedHTMLMessage
                            className="secondary"
                            id="tips_js.liquid_token"
                            params={{ LIQUID_TOKEN, VESTING_TOKEN }}
                        />
                    </div>
                    <div className="column small-12 medium-4">
                        {isMyAccount ? (
                            <DropdownMenu
                                className="Wallet_dropdown"
                                items={balance_menu}
                                el="li"
                                selected={`${balance_str} ${
                                    LIQUID_TOKEN_UPPERCASE
                                }`}
                            />
                        ) : (
                            `${balance_str} ${LIQUID_TOKEN_UPPERCASE}`
                        )}
                    </div>
                </div>
                <div className="UserWallet__balance row zebra">
                    <div className="column small-12 medium-8">
                        {VESTING_TOKEN}
                        <FormattedHTMLMessage
                            className="secondary"
                            id="tips_js.influence_token"
                        />
                    </div>
                    <div className="column small-12 medium-4">
                        {isMyAccount ? (
                            <DropdownMenu
                                className="Wallet_dropdown"
                                items={power_menu}
                                el="li"
                                selected={`${stake_balance_str} ${
                                    LIQUID_TOKEN_UPPERCASE
                                }`}
                            />
                        ) : (
                            `${stake_balance_str} ${LIQUID_TOKEN_UPPERCASE}`
                        )}
                    </div>
                </div>
                <div className="UserWallet__balance row">
                    <div className="column small-12">
                        {!!parseFloat(pendingUnstakeBalance) && (
                            <span>
                                Pending unstake: {pending_unstake_balance_str}{' '}
                                {LIQUID_TOKEN_UPPERCASE}.
                            </span>
                        )}
                        <TransactionError opType="withdraw_vesting" />
                    </div>
                </div>
                {disabledWarning && (
                    <div className="row">
                        <div className="column small-12">
                            <div className="callout warning">
                                {tt(
                                    'userwallet_jsx.transfers_are_temporary_disabled'
                                )}
                            </div>
                        </div>
                    </div>
                )}
                <div className="row">
                    <div className="column small-12">
                        <hr />
                    </div>
                </div>

                <div className="row">
                    <div className="column small-12">
                        {/** history */}
                        <h4>{tt('userwallet_jsx.history')}</h4>
                        <div className="secondary">
                            <span>
                                {tt(
                                    'transfer_jsx.beware_of_spam_and_phishing_links'
                                )}
                            </span>
                            &nbsp;
                            <span>
                                {tt(
                                    'transfer_jsx.transactions_make_take_a_few_minutes'
                                )}
                            </span>
                        </div>
                        <table>
                            <tbody>{transfer_log}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }
}

export default connect(
    // mapStateToProps
    (state, ownProps) => {
        const gprops = state.global.get('props');
        return {
            ...ownProps,
            gprops: state.global.get('props').toJS(),
        };
    },
    // mapDispatchToProps
    dispatch => ({
        claimRewards: account => {
            const username = account.get('name');
            const successCallback = () => {
                dispatch(
                    globalActions.getState({ url: `@${username}/transfers` })
                );
            };

            const operation = {
                account: username,
                reward_steem: account.get('reward_steem_balance'),
                reward_vests: account.get('reward_vesting_balance'),
            };

            dispatch(
                transactionActions.broadcastOperation({
                    type: 'claim_reward_balance',
                    operation,
                    successCallback,
                })
            );
        },
    })
)(UserWallet);
